import glob, sys, json, datetime, collections, os, itertools, csv

src_dir, out_path = sys.argv[1], sys.argv[2]
files = sorted(glob.glob(os.path.join(src_dir, '*.csv')) + glob.glob(os.path.join(src_dir, '*.xlsx')))

# Document types: 1 tax invoice, 2 tax invoice-receipt (both sales), 3 credit note.
# Revenue is net (credits subtract); a credit note is not counted as an order.
CREDIT = '3'


def num(x):
    if isinstance(x, (int, float)):
        return x
    try:
        return float(str(x).strip() or 0)
    except ValueError:
        return 0


def read_rows(p):
    # CSV exports: UTF-16, no header, dates as dd/mm/yyyy. Excel exports: header row, real dates.
    if p.lower().endswith('.csv'):
        with open(p, encoding='utf-16', newline='') as f:
            for r in csv.reader(f):
                if len(r) < 30:
                    continue
                try:
                    r[3] = datetime.datetime.strptime(r[3].strip(), '%d/%m/%Y')
                except ValueError:
                    continue
                yield r
    else:
        import openpyxl
        ws = openpyxl.load_workbook(p, read_only=True, data_only=True).worksheets[0]
        rows = ws.iter_rows(values_only=True)
        next(rows)
        for r in rows:
            yield list(r)

# year -> month -> {rev, orders}
ym = collections.defaultdict(lambda: collections.defaultdict(lambda: {'rev': 0.0, 'orders': 0}))
# cust_id -> year -> month -> [orders, rev]
cust = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0.0])))
cust_name = {}  # cust_id -> (date, name)
cust_city = {}
cust_phone = {}  # cust_id -> (date, phone)
items = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))  # year -> item -> [rev, qty]
# item -> year -> month -> [rev, qty]; item -> year -> cust -> [rev, qty]
item_m = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0])))
item_c = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))))
item_code = collections.defaultdict(collections.Counter)
orders = collections.defaultdict(dict)  # cust -> doc key -> [yyyymmdd, rev, lines]
doc_items = collections.defaultdict(set)  # (year, doc key) -> items on that order
last_date = None

cust_names = collections.defaultdict(set)  # cust_id -> every name seen, to spot shared walk-in accounts

for p in files:
    seen = set()
    for r in read_rows(p):
        if r[1] in (None, '') or not isinstance(r[3], datetime.datetime):
            continue
        d = r[3]
        y, m = d.year, d.month
        cid = int(num(r[5]))
        credit = str(r[0]).strip() == CREDIT
        name = str(r[11] or '').strip() or f'לקוח {cid}'
        cust_names[cid].add(name)
        key = (str(r[0]).strip(), str(r[1]).strip())
        if key not in seen:
            seen.add(key)
            rev = num(r[6])
            ym[y][m]['rev'] += rev
            ym[y][m]['orders'] += 0 if credit else 1
            c = cust[cid][y][m]
            c[0] += 0 if credit else 1
            c[1] += rev
            if cid not in cust_name or d >= cust_name[cid][0]:
                cust_name[cid] = (d, name)
                cust_city[cid] = str(r[24] or '').strip()
            # Most recent non-empty phone, formatted as 0<prefix>-<number>
            pre, phone = int(num(r[27])), int(num(r[28]))
            if phone > 0 and (cid not in cust_phone or d >= cust_phone[cid][0]):
                cust_phone[cid] = (d, f'0{pre}-{phone}' if pre > 0 else str(phone))
            if last_date is None or d > last_date:
                last_date = d
            if not credit:
                orders[cid][(y,) + key] = [int(d.strftime('%Y%m%d')), round(rev), 0]
        if not credit:
            orders[cid][(y,) + key][2] += 1
        desc = ' '.join(str(r[19] or '').split())
        if desc:
            k = desc
            lr = num(r[22])
            # Credit lines carry a positive quantity and a negative price: returned units subtract
            lq = -abs(num(r[20])) if credit else num(r[20])
            it = items[y][k]
            it[0] += lr
            it[1] += lq
            a = item_m[k][y][m]; a[0] += lr; a[1] += lq
            b = item_c[k][y][cid][m]; b[0] += lr; b[1] += lq
            code = str(r[29] or '').strip()
            if code: item_code[k][code] += 1
            if not credit:
                doc_items[(y,) + key].add(k)

# One account number used for many different walk-in buyers: a fixed name, and no single city or phone
for cid, names in cust_names.items():
    if len(names) > 20:
        cust_name[cid] = (cust_name[cid][0], 'לקוחות מזדמנים')
        cust_city[cid] = ''
        cust_phone.pop(cid, None)

years = sorted(ym)
LY, LM = last_date.year, last_date.month

# Items bought on the same order: keep pairs seen on 3+ orders that occur together
# at least twice as often as chance (lift >= 2), strongest first
item_docs = collections.Counter()
pair_docs = collections.Counter()
for its in doc_items.values():
    for a in its:
        item_docs[a] += 1
    if 1 < len(its) <= 40:
        for a, b in itertools.combinations(sorted(its), 2):
            pair_docs[(a, b)] += 1
n_docs = len(doc_items)
partners = collections.defaultdict(list)
for (a, b), co in pair_docs.items():
    if co < 3:
        continue
    for x, z in ((a, b), (b, a)):
        conf = co / item_docs[x]
        lift = conf / (item_docs[z] / n_docs)
        if lift >= 2:
            partners[x].append((conf, co, lift, z))

item_order = sorted(item_m, key=lambda k: -sum(v[0] for mm in item_m[k].values() for v in mm.values()))
item_idx = {k: i for i, k in enumerate(item_order)}

def cust_sum(cc, max_m=12):
    out = {}
    for c, mm in cc.items():
        rv = sum(v[0] for m, v in mm.items() if m <= max_m)
        qt = sum(v[1] for m, v in mm.items() if m <= max_m)
        if rv or qt:
            out[str(c)] = [round(rv), round(qt)]
    return out
out = {
    'lastDate': last_date.strftime('%Y-%m-%d'),
    'years': years,
    # monthly[y] = [[rev, orders] x12]
    'monthly': {y: [[round(ym[y][m]['rev']), ym[y][m]['orders']] for m in range(1, 13)] for y in years},
    # customers: id -> {n: name, c: city, d: {year: [[orders, rev] x12 sparse as dict]}}
    'customers': {
        str(cid): {
            'n': cust_name[cid][1],
            'c': cust_city.get(cid, ''),
            'p': cust_phone[cid][1] if cid in cust_phone else '',
            'd': {y: {m: [v[0], round(v[1])] for m, v in mm.items()} for y, mm in yy.items()},
            'o': sorted(orders[cid].values()),
        }
        for cid, yy in cust.items()
    },
    # items: [name, code, {year: {month: [rev, qty]}}, {year: {cust: [rev, qty]}}, {cust: [rev, qty]} for Jan..LM of LY-1,
    #         {year: {cust: {month: [rev, qty]}}}, orders with the item,
    #         [[partner index, orders together, % of this item's orders, lift] x up to 5]]
    'items': [
        [k, item_code[k].most_common(1)[0][0] if item_code[k] else '',
         {y: {m: [round(v[0]), round(v[1])] for m, v in mm.items()} for y, mm in item_m[k].items()},
         {y: cust_sum(cc) for y, cc in item_c[k].items()},
         cust_sum(item_c[k].get(LY - 1, {}), LM),
         {y: {str(c): {m: [round(v[0]), round(v[1])] for m, v in mm.items()} for c, mm in cc.items()} for y, cc in item_c[k].items()},
         item_docs[k],
         [[item_idx[z], co, round(conf * 100), round(lift, 1)] for conf, co, lift, z in sorted(partners[k], reverse=True)[:5]]]
        for k in item_order
    ],
    'topItems': {
        y: [[k, round(v[0]), round(v[1])] for k, v in sorted(items[y].items(), key=lambda kv: -kv[1][0])[:15]]
        for y in years
    },
}
with open(out_path, 'w', encoding='utf-8') as f:
    f.write('window.FLACAR_DATA = ')
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')

for y in years:
    print(y, sum(v[1] for v in out['monthly'][y]), sum(v[0] for v in out['monthly'][y]))
print('pairs', sum(1 for v in partners.values() if v), 'items with partners')
print('customers', len(out['customers']), 'last', out['lastDate'], 'bytes', os.path.getsize(out_path))
