import subprocess, os, pathlib

OUT = pathlib.Path(__file__).parent
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

CSS = """
@font-face{font-family:'BC';src:url('file:///root/.fonts/BarlowCondensed-Black.ttf');font-weight:900}
@font-face{font-family:'BC';src:url('file:///root/.fonts/BarlowCondensed-Bold.ttf');font-weight:700}
@font-face{font-family:'B';src:url('file:///root/.fonts/Barlow-Regular.ttf');font-weight:400}
@font-face{font-family:'B';src:url('file:///root/.fonts/Barlow-SemiBold.ttf');font-weight:600}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1290px;height:2796px;overflow:hidden}
.frame{width:1290px;height:2796px;position:relative;display:flex;flex-direction:column;align-items:center}
.caption{padding:150px 90px 46px;text-align:center;width:100%}
.caption h1{font-family:'BC';font-weight:900;font-size:118px;line-height:0.92;letter-spacing:-1px;text-transform:uppercase}
.caption p{font-family:'B';font-weight:600;font-size:40px;margin-top:26px;letter-spacing:0.3px}
.device{width:1130px;height:1980px;background:#fff;border-radius:66px 66px 0 0;overflow:hidden;
        box-shadow:0 40px 90px rgba(0,0,0,0.28);border:14px solid #111;border-bottom:none}
.app{width:100%;height:100%;background:#fff;display:flex;flex-direction:column}
/* app header */
.ah{display:flex;align-items:center;justify-content:space-between;padding:34px 40px 26px;border-bottom:5px solid #111}
.ah .wm{font-family:'BC';font-weight:900;font-size:62px;letter-spacing:1px;color:#111}
.ah .ic{display:flex;gap:26px;font-size:44px}
.pill{margin:26px 40px 8px;border:4px solid #111;border-radius:0;padding:22px 30px;font-family:'B';color:#8a8a8a;font-size:34px;display:flex;align-items:center;gap:18px}
/* grid */
.grid{display:grid;grid-template-columns:1fr 1fr;gap:26px;padding:22px 40px}
.card{border:4px solid #111;background:#fff;display:flex;flex-direction:column}
.ph{height:360px;position:relative;display:flex;align-items:flex-end;justify-content:space-between;padding:18px}
.ph .cat{font-family:'BC';font-weight:900;font-size:30px;color:#fff;text-transform:uppercase;letter-spacing:1px;text-shadow:0 2px 8px rgba(0,0,0,.35)}
.ph .heart{width:56px;height:56px;background:rgba(255,255,255,.9);border:3px solid #111;display:flex;align-items:center;justify-content:center;font-size:30px}
.meta{padding:16px 18px 20px}
.meta .nm{font-family:'B';font-weight:600;font-size:32px;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta .row{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
.meta .pr{font-family:'BC';font-weight:900;font-size:40px;color:#111}
.meta .sz{font-family:'BC';font-weight:700;font-size:26px;color:#fff;background:#111;padding:3px 14px}
/* bottom nav */
.bn{margin-top:auto;display:flex;justify-content:space-around;align-items:center;padding:24px 0 30px;border-top:5px solid #111}
.bn .b{font-size:46px;opacity:.85}
.bn .sell{width:78px;height:78px;border-radius:50%;background:#FF1493;border:4px solid #111;display:flex;align-items:center;justify-content:center;color:#fff;font-size:44px}
/* detail screen */
.dhero{height:1120px;position:relative;display:flex;align-items:flex-start;justify-content:space-between;padding:34px}
.dhero .back{width:70px;height:70px;background:rgba(255,255,255,.92);border:4px solid #111;display:flex;align-items:center;justify-content:center;font-size:40px}
.dhero .dots{position:absolute;bottom:34px;left:0;right:0;display:flex;justify-content:center;gap:14px}
.dhero .dot{width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.6)}
.dhero .dot.on{background:#fff;width:44px;border-radius:8px}
.dbody{padding:34px 42px}
.dbody .t{font-family:'BC';font-weight:900;font-size:60px;color:#111;line-height:1;text-transform:uppercase}
.dbody .sub{font-family:'B';font-weight:600;font-size:34px;color:#8a8a8a;margin-top:12px}
.dbody .price{font-family:'BC';font-weight:900;font-size:74px;color:#FF1493;margin:22px 0 10px}
.chips{display:flex;flex-wrap:wrap;gap:16px;margin-top:16px}
.chip{border:4px solid #111;padding:14px 26px;font-family:'B';font-weight:600;font-size:30px}
.chip.teal{background:#00E5CC}
.meas{margin-top:30px;border:4px solid #111;padding:26px 30px}
.meas h3{font-family:'BC';font-weight:900;font-size:34px;letter-spacing:1px;margin-bottom:16px}
.meas .mrow{display:flex;justify-content:space-between;font-family:'B';font-size:32px;padding:10px 0;border-bottom:2px solid #eee}
.buybar{margin-top:auto;border-top:5px solid #111;display:flex;align-items:center;justify-content:space-between;padding:30px 40px}
.buybar .p{font-family:'BC';font-weight:900;font-size:56px;color:#111}
.buybar .btn{background:#FF1493;color:#fff;border:4px solid #111;font-family:'BC';font-weight:900;font-size:40px;letter-spacing:2px;padding:24px 46px}
/* sell / value screen */
.vwrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;text-align:center;gap:40px}
.vbadge{width:230px;height:230px;border-radius:50%;background:#FF1493;border:8px solid #111;display:flex;align-items:center;justify-content:center;font-size:130px}
.vwrap h2{font-family:'BC';font-weight:900;font-size:84px;line-height:0.95;text-transform:uppercase;color:#111}
.vlist{display:flex;flex-direction:column;gap:22px;width:100%;margin-top:10px}
.vitem{border:4px solid #111;padding:30px 34px;display:flex;align-items:center;gap:24px;font-family:'B';font-weight:600;font-size:38px;text-align:left}
.vitem .k{width:74px;height:74px;background:#00E5CC;border:4px solid #111;display:flex;align-items:center;justify-content:center;font-size:42px;flex-shrink:0}
"""

# garment placeholder gradients (stylised, not photos)
CARDS = [
    ("Bridal Lehenga", "£145", "M", "linear-gradient(135deg,#7a0b2e,#c9963b)"),
    ("Banarasi Saree", "£68", "FREE", "linear-gradient(135deg,#046b5f,#00E5CC)"),
    ("Salwar Kameez", "£42", "L", "linear-gradient(135deg,#ff6aa8,#ffd0a6)"),
    ("Anarkali Gown", "£89", "S", "linear-gradient(135deg,#5b2a86,#d64ea6)"),
    ("Sharara Set", "£55", "M", "linear-gradient(135deg,#c98a00,#ffd85e)"),
    ("Cotton Kurta", "£28", "XL", "linear-gradient(135deg,#8a8f7a,#efe7d2)"),
]

def cards_html():
    out=[]
    for nm,pr,sz,grad in CARDS:
        out.append(f'''<div class="card"><div class="ph" style="background:{grad}">
          <span class="cat">{nm.split()[-1]}</span><span class="heart">♡</span></div>
          <div class="meta"><div class="nm">{nm}</div>
          <div class="row"><span class="pr">{pr}</span><span class="sz">{sz}</span></div></div></div>''')
    return "".join(out)

def shot_shop():
    return f'''<div class="frame" style="background:#FF1493">
      <div class="caption"><h1 style="color:#fff">Preloved<br>South Asian<br>fashion</h1>
      <p style="color:#fff">Loved pieces, new owners.</p></div>
      <div class="device"><div class="app">
        <div class="ah"><span class="wm">STITCH'D</span><span class="ic">♡ &nbsp; ▤</span></div>
        <div class="pill">⌕ &nbsp; Search lehengas, sarees, brands…</div>
        <div class="grid">{cards_html()}</div>
        <div class="bn"><span class="b">⌂</span><span class="b">⌕</span><span class="sell">＋</span><span class="b">♡</span><span class="b">☰</span></div>
      </div></div></div>'''

def shot_detail():
    return f'''<div class="frame" style="background:#111">
      <div class="caption"><h1 style="color:#fff">Real<br>measurements.<br><span style="color:#00E5CC">Honest fits.</span></h1>
      <p style="color:#c8c8c8">Every listing, measured properly.</p></div>
      <div class="device"><div class="app">
        <div class="dhero" style="background:linear-gradient(135deg,#7a0b2e,#c9963b)">
          <span class="back">‹</span>
          <span class="heart" style="width:70px;height:70px;font-size:40px">♡</span>
          <div class="dots"><span class="dot on"></span><span class="dot"></span><span class="dot"></span></div>
        </div>
        <div class="dbody">
          <div class="t">Bridal Lehenga</div>
          <div class="sub">Worn once · Maroon &amp; gold · Zardozi work</div>
          <div class="price">£145</div>
          <div class="chips"><span class="chip">Size M</span><span class="chip teal">Excellent</span><span class="chip">Silk</span></div>
          <div class="meas"><h3>MEASUREMENTS</h3>
            <div class="mrow"><span>Bust</span><span>38"</span></div>
            <div class="mrow"><span>Waist</span><span>30"</span></div>
            <div class="mrow"><span>Blouse length</span><span>15"</span></div>
          </div>
        </div>
        <div class="buybar"><span class="p">£145</span><span class="btn">ADD TO BAG</span></div>
      </div></div></div>'''

def shot_sell():
    return f'''<div class="frame" style="background:#00E5CC">
      <div class="caption"><h1 style="color:#111">Sell for free.<br>Get paid<br>safely.</h1>
      <p style="color:#0a5a52">No seller fees. Buyer Protection built in.</p></div>
      <div class="device"><div class="app">
        <div class="ah"><span class="wm">STITCH'D</span><span class="ic">♡ &nbsp; ▤</span></div>
        <div class="vwrap">
          <div class="vbadge">🧵</div>
          <h2>List in minutes</h2>
          <div class="vlist">
            <div class="vitem"><span class="k">£0</span><span>Sellers list free — no commission taken</span></div>
            <div class="vitem"><span class="k">🛡</span><span>Buyer Protection on every order</span></div>
            <div class="vitem"><span class="k">↺</span><span>Paid safely to your wallet after delivery</span></div>
            <div class="vitem"><span class="k">✂</span><span>Book a trusted tailor for alterations</span></div>
          </div>
        </div>
        <div class="bn"><span class="b">⌂</span><span class="b">⌕</span><span class="sell">＋</span><span class="b">♡</span><span class="b">☰</span></div>
      </div></div></div>'''

SHOTS = {"01-shop":shot_shop(), "02-detail":shot_detail(), "03-sell":shot_sell()}

for name, body in SHOTS.items():
    html = f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{body}</body></html>"
    hp = OUT/f"{name}.html"; hp.write_text(html)
    png = OUT/f"stitchd-{name}.png"
    subprocess.run([CHROME,"--headless","--no-sandbox","--hide-scrollbars","--force-device-scale-factor=1",
                    f"--screenshot={png}","--window-size=1290,2796",f"file://{hp}"],
                   check=True, capture_output=True)
    print("rendered", png.name)
print("done")
