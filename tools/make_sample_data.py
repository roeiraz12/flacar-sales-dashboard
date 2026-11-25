"""Generate SYNTHETIC sales exports in the same layout as the real accounting-system CSVs.

Every customer, product, address, phone and amount here is made up. The files have the
same shape as the real exports (UTF-16, no header row, 42 columns, dd/mm/yyyy dates), so
tools/build_data.py can read them unchanged.

Usage: python tools/make_sample_data.py [out_dir] [seed]
"""
import csv
import datetime as dt
import os
import random
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'sample-data')
rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 2024)

START, END = dt.date(2024, 1, 1), dt.date(2026, 11, 12)
DOCS_PER_DAY = 9.5                      # average sales documents per business day
GROWTH = {2024: 1.0, 2025: 1.06, 2026: 1.13}
SEASON = [1.05, 0.95, 1.0, 0.85, 0.95, 0.9, 1.0, 1.05, 0.95, 0.7, 1.1, 1.0]  # Jan..Dec (holidays in Oct)

# --- Customers -----------------------------------------------------------------------
CITIES = {
    'תל אביב': '03', 'רמת גן': '03', 'בני ברק': '03', 'חולון': '03', 'בת ים': '03',
    'פתח תקווה': '03', 'ראשון לציון': '03', 'ראש העין': '03', 'יהוד': '03', 'אור יהודה': '03',
    'חיפה': '04', 'קריית אתא': '04', 'עפולה': '04', 'נצרת': '04', 'כרמיאל': '04', 'קיסריה': '04',
    'חדרה': '04', 'נתניה': '09', 'כפר סבא': '09', 'רעננה': '09', 'הרצליה': '09', 'הוד השרון': '09',
    'ירושלים': '02', 'בית שמש': '02', 'מודיעין': '08', 'רחובות': '08', 'אשדוד': '08',
    'אשקלון': '08', 'באר שבע': '08', 'קריית גת': '08', 'אילת': '08', 'טבריה': '04',
}
STREETS = ['המלאכה', 'התעשייה', 'החרושת', 'הנפח', 'הסדנה', 'היוצרים', 'המסגר', 'הברזל',
           'הפלדה', 'העבודה', 'השקמה', 'האורן', 'הרצל', 'ז\'בוטינסקי', 'ויצמן', 'בן גוריון']
FIRST = ['אופק', 'גלבוע', 'נחשון', 'ארבל', 'תבור', 'כרמלי', 'שקד', 'רימון', 'אלון', 'ברוש',
         'דקל', 'זית', 'צבר', 'ערבה', 'נגבי', 'גלילי', 'שרוני', 'עמקי', 'חרמון', 'יובל',
         'מעיין', 'אגמון', 'סלעי', 'צור', 'נוף', 'שחר', 'לביא', 'נשר', 'דרור', 'עפרוני']
KIND = ['מוסך', 'מוסך', 'מוסך', 'חשמל רכב', 'אביזרי רכב', 'מרכז שירות', 'צמיגי', 'מיזוג רכב',
        'סדנת', 'מערכות שמע', 'מוסך משאיות', 'פחחות וצבע']
SUFFIX = ['בע"מ', 'בע"מ', 'בע"מ', '', '', 'ובניו', 'שירותי רכב', 'מוטורס', 'סחר']
WALK_IN_ID = 100
WALK_IN_NAMES = [f'{a} {b}' for a in ['דני', 'מיכל', 'יוסי', 'רונית', 'אבי', 'שירה', 'עומר', 'נועה']
                 for b in ['א.', 'ב.', 'ג.', 'ד.', 'ה.']]


def make_customers(n=180):
    names, out = set(), []
    while len(out) < n:
        name = ' '.join(x for x in (rnd.choice(KIND), rnd.choice(FIRST), rnd.choice(SUFFIX)) if x)
        if name in names:
            continue
        names.add(name)
        city = rnd.choice(list(CITIES))
        out.append({
            'id': 200 + len(out) * 3 + rnd.randint(0, 2),
            'name': name,
            'city': city,
            'addr': f'{rnd.choice(STREETS)} {rnd.randint(1, 60)}',
            'pre': CITIES[city],
            'phone': str(5550000 + rnd.randint(0, 9999)),   # 555-xxxx: reserved-looking fake numbers
            'weight': rnd.paretovariate(1.3),               # a few big accounts, a long tail
            'start': START + dt.timedelta(days=rnd.choice([0, 0, 0, rnd.randint(0, 900)])),
            'churn': END + dt.timedelta(days=1) if rnd.random() > 0.12 else START + dt.timedelta(days=rnd.randint(300, 1000)),
        })
    return out


# --- Products ------------------------------------------------------------------------
PRODUCTS = [
    # (base name, variants, price range)
    ('כבל חשמל רב גידי', ['2X0.75', '2X1.5', '3X1.5', '4X1', '7X1.5'], (4, 18)),
    ('פנס LED עגול', ['12V', '24V', '12/24V', 'עם מפסק', 'ללא מפסק'], (25, 90)),
    ('פנס עבודה LED', ['18W', '27W', '48W', '72W'], (60, 260)),
    ('פנס סימון צד', ['כתום', 'לבן', 'אדום'], (12, 35)),
    ('נורת הלוגן', ['H1', 'H3', 'H4', 'H7', 'H11'], (8, 30)),
    ('נורת LED', ['T10', 'BA15S', 'BAY15D', 'H4', 'H7'], (10, 70)),
    ('פיוז סכין', ['5A', '10A', '15A', '20A', '30A'], (0.8, 3)),
    ('בית פיוז', ['סכין', 'אמריקאי', 'זכוכית', 'מגה'], (6, 40)),
    ('ממסר', ['12V 40A', '24V 40A', '12V 70A', 'הבהוב'], (14, 55)),
    ('מפסק מתג', ['ON-OFF', 'ON-OFF-ON', 'מואר', 'אטום למים'], (9, 45)),
    ('שקע USB כפול', ['12V', '24V', 'עם מד מתח', 'מהיר'], (25, 85)),
    ('סרט בידוד', ['שחור', 'אדום', 'בד', 'מקצועי'], (2.5, 14)),
    ('שרוול מתכווץ', ['3 ממ', '6 ממ', '9 ממ', '12 ממ', 'מגוון'], (3, 40)),
    ('חבק ניילון', ['100X2.5', '200X3.6', '300X4.8', '200X25'], (4, 28)),
    ('נעל כבל', ['כחולה', 'אדומה', 'צהובה', 'מבודדת'], (0.3, 2)),
    ('מחבר אטום', ['2 פינים', '3 פינים', '4 פינים', '6 פינים'], (7, 30)),
    ('צופר', ['חשמלי', 'אוויר', 'רוורס', 'כפול'], (35, 180)),
    ('זמזם רוורס', ['12V', '24V', 'מדבר'], (20, 70)),
    ('בדיל הלחמה', ['0.8 ממ', '1.2 ממ', '2 ממ'], (25, 90)),
    ('מהדק מצבר', ['פליז', 'עופרת', 'מהיר'], (8, 30)),
    ('כבל התנעה', ['200A', '400A', '600A'], (60, 220)),
    ('שרשור מפוצל', ['7 ממ', '10 ממ', '13 ממ', '17 ממ'], (40, 160)),
    ('מנורת תקרה', ['2 מגעים', 'LED', 'עם מפסק'], (15, 60)),
    ('מצלמת רוורס', ['סטנדרט', 'רחבת זווית', 'למשאית'], (120, 450)),
    ('ממיר מתח', ['24V ל-12V', '12V ל-230V 300W', '12V ל-230V 1000W'], (90, 900)),
]


def make_items():
    out, code = [], 1000
    for base, variants, (lo, hi) in PRODUCTS:
        for v in variants:
            code += rnd.randint(1, 9)
            price = round(rnd.uniform(lo, hi), 2)
            out.append({'name': f'{base} {v}', 'code': str(code), 'price': price,
                        'pop': rnd.paretovariate(1.1), 'id': code - 400})
    out.append({'name': 'משלוח', 'code': '9001', 'price': 45.0, 'pop': 6, 'id': 8601})
    return out


def pick(seq, weights):
    return rnd.choices(seq, weights=weights, k=1)[0]


def main():
    customers, items = make_customers(), make_items()
    w_items = [i['pop'] for i in items]
    # Items that tend to be bought together (gives the "bought with" panel something to find)
    bundles = [rnd.sample(items, 3) for _ in range(25)]
    lines_by_year = {}
    doc_no = {'1': 38000, '2': 61000, '3': 7000}
    day = START
    while day <= END:
        if day.weekday() in (4, 5):              # Friday / Saturday: closed
            day += dt.timedelta(days=1)
            continue
        lam = DOCS_PER_DAY * GROWTH[day.year] * SEASON[day.month - 1]
        n_docs = max(0, int(rnd.gauss(lam, lam ** 0.5)))
        active = [c for c in customers if c['start'] <= day < c['churn']]
        for _ in range(n_docs):
            walk_in = rnd.random() < 0.04
            c = None if walk_in else pick(active, [x['weight'] for x in active])
            r = rnd.random()
            dtype = '3' if r < 0.045 else ('2' if r < 0.075 or walk_in else '1')
            doc_no[dtype] += 1
            # Choose order lines
            chosen = []
            if rnd.random() < 0.3:
                chosen += rnd.choice(bundles)
            for _ in range(max(1, int(rnd.expovariate(1 / 2.2)))):
                chosen.append(pick(items, w_items))
            if dtype == '3':
                chosen = chosen[:1]
            seen, lines = set(), []
            for it in chosen:
                if it['code'] in seen:
                    continue
                seen.add(it['code'])
                qty = max(1, int(rnd.expovariate(1 / (40 if it['price'] < 5 else 8 if it['price'] < 50 else 2))))
                price = round(it['price'] * rnd.uniform(0.9, 1.05), 2)
                total = round(qty * price, 2) * (-1 if dtype == '3' else 1)
                lines.append((it, qty, -price if dtype == '3' else price, total))
            doc_total = round(sum(l[3] for l in lines), 2)
            vat = round(doc_total * 0.18, 2)
            if walk_in:
                cid, name, city, addr, pre, phone = WALK_IN_ID, rnd.choice(WALK_IN_NAMES), '', '', '0', '0'
            else:
                cid, name, city, addr, pre, phone = c['id'], c['name'], c['city'], c['addr'], c['pre'], c['phone']
            for it, qty, price, total in lines:
                lines_by_year.setdefault(day.year, []).append([
                    dtype, str(doc_no[dtype]), '0', day.strftime('%d/%m/%Y'), '100', str(cid),
                    f'{doc_total:.2f}', '0', f'{vat:.2f}', f'{doc_total + vat:.2f}', '', name, '', '',
                    '0', '', '', '1.00', str(it['id']), it['name'] + ' ', f'{qty:.4f}', f'{price:.4f}',
                    f'{total:.4f}', addr, city, '0', '0', pre, phone, it['code'].ljust(15), '1', '1', '1',
                    '0', ' [demo]', '0', f'customer{cid}@example.com', pre, phone, '1', '0', '0',
                ])
        day += dt.timedelta(days=1)

    os.makedirs(OUT, exist_ok=True)
    for y, rows in sorted(lines_by_year.items()):
        p = os.path.join(OUT, f'{y}.csv')
        with open(p, 'w', encoding='utf-16', newline='') as f:
            csv.writer(f, lineterminator='\r\n').writerows(rows)
        print(p, len(rows), 'lines')


if __name__ == '__main__':
    main()
