import React, { useState } from "react";

/* ------------------------------------------------------------------ *
 * How to Measure — gender toggle, garment-specific accordions,
 * inline SVG body diagrams with numbered measurement markers.
 *
 * Marker coordinates are tuned to the silhouette viewBox (0 0 200 430).
 * Diagrams are deliberately simple flat-fashion silhouettes — they only
 * need to be recognisable, not anatomically accurate.
 * ------------------------------------------------------------------ */

const PINK = "#FF1493";
const BC = "'Barlow Condensed',sans-serif";

// [label, description, markerX, markerY]
const GARMENTS = {
  women: [
    {
      key: "saree",
      name: "Saree",
      marks: [
        ["Blouse bust", "Around the fullest part of the chest", 100, 92],
        ["Blouse waist", "Around the natural waist", 100, 126],
        ["Blouse length", "Shoulder to bottom of blouse", 138, 116],
        ["Saree length", "Full length of the saree drape (usually a standard 5.5m — note any alterations)", 46, 275],
        ["Blouse sleeve length", "Shoulder seam to wrist", 52, 150],
      ],
    },
    {
      key: "lehenga",
      name: "Lehenga",
      // Custom measurement image replaces the SVG diagram + numbered legend.
      // The image already includes the numbered legend.
      image: "/Images/lehenga-measurements.png",
      marks: [
        ["Waist", "Around the natural waist", 100, 146],
        ["Hip", "Around the fullest part of the hips, 8 inches below waist", 100, 182],
        ["Lehenga length", "Waist to hem", 152, 285],
        ["Blouse bust", "Around the fullest part of the chest", 100, 92],
        ["Blouse waist", "Around the natural waist", 100, 122],
        ["Blouse length", "Shoulder to bottom of blouse", 138, 112],
      ],
    },
    {
      key: "salwar",
      name: "Salwar Kameez / Suit",
      image: "/Images/salwar-kameez-measurements.png",
      marks: [
        ["Bust", "Around the fullest part of the chest", 100, 92],
        ["Waist", "Around the natural waist", 100, 140],
        ["Hip", "Around the fullest part of the hips", 100, 178],
        ["Kameez length", "Shoulder to hem", 144, 250],
        ["Sleeve length", "Shoulder seam to wrist", 52, 200],
        ["Trouser waist", "Around the waist where the trouser sits", 120, 168],
        ["Trouser length", "Waist to ankle", 122, 335],
      ],
    },
    {
      key: "anarkali",
      name: "Anarkali",
      image: "/Images/anarkali-measurements.png",
      marks: [
        ["Bust", "Around the fullest part of the chest", 100, 92],
        ["Waist", "Around the natural waist", 100, 140],
        ["Hip", "Around the fullest part of the hips", 100, 178],
        ["Length", "Shoulder to floor", 152, 350],
        ["Sleeve length", "Shoulder seam to wrist", 52, 200],
      ],
    },
    {
      key: "sharara",
      name: "Sharara / Gharara",
      image: "/Images/sharara-measurements.png",
      marks: [
        ["Waist", "Around the natural waist", 100, 140],
        ["Hip", "Around the fullest part of the hips", 100, 178],
        ["Top length", "Shoulder to bottom of top", 140, 212],
        ["Sleeve length", "Shoulder seam to wrist", 52, 195],
        ["Sharara length", "Waist to ankle", 122, 335],
      ],
    },
    {
      key: "dupatta",
      name: "Dupatta / Stole",
      image: "/Images/dupatta-measurements.png",
      marks: [
        ["Length", "End to end", 30, 150],
        ["Width", "Selvage to selvage", 100, 70],
      ],
    },
    {
      key: "dress",
      name: "Dress / Gown",
      image: "/Images/dress-gown-measurements.png",
      marks: [
        ["Bust", "Around the fullest part of the chest", 100, 92],
        ["Waist", "Around the natural waist", 100, 140],
        ["Hip", "Around the fullest part of the hips", 100, 178],
        ["Length", "Shoulder to hem", 152, 350],
        ["Sleeve length", "Shoulder seam to wrist", 52, 200],
      ],
    },
  ],
  men: [
    {
      key: "sherwani",
      name: "Sherwani",
      image: "/Images/sherwani-measurements.png",
      marks: [
        ["Chest", "Around the fullest part of the chest, arms relaxed", 100, 96],
        ["Waist", "Around the natural waist", 100, 150],
        ["Shoulder width", "Seam to seam across the back", 100, 66],
        ["Sherwani length", "Back of neck to hem", 142, 250],
        ["Sleeve length", "Shoulder seam to wrist", 52, 205],
        ["Trouser waist", "Around the waist where the trouser sits", 122, 170],
        ["Trouser length", "Waist to ankle", 124, 340],
        ["Inseam", "Crotch to ankle", 100, 225],
      ],
    },
    {
      key: "kurta",
      name: "Kurta / Kurta Pyjama",
      image: "/Images/kurta-measurements.png",
      marks: [
        ["Chest", "Around the fullest part of the chest", 100, 96],
        ["Waist", "Around the natural waist", 100, 150],
        ["Shoulder width", "Seam to seam across the back", 100, 66],
        ["Kurta length", "Back of neck to hem", 142, 250],
        ["Sleeve length", "Shoulder seam to wrist", 52, 205],
        ["Pyjama waist", "Around the waist where the pyjama sits", 122, 170],
        ["Pyjama length", "Waist to ankle", 124, 340],
        ["Inseam", "Crotch to ankle", 100, 225],
      ],
    },
    {
      key: "nehru",
      name: "Nehru Jacket / Waistcoat",
      image: "/Images/nehru-jacket-measurements.png",
      marks: [
        ["Chest", "Around the fullest part of the chest", 100, 96],
        ["Waist", "Around the natural waist", 100, 150],
        ["Shoulder width", "Seam to seam across the back", 100, 66],
        ["Jacket length", "Back of neck to hem", 142, 230],
      ],
    },
    {
      key: "indo",
      name: "Indo-Western Suit",
      image: "/Images/indo-western-measurements.png",
      marks: [
        ["Chest", "Around the fullest part of the chest", 100, 96],
        ["Waist", "Around the natural waist", 100, 150],
        ["Shoulder width", "Seam to seam across the back", 100, 66],
        ["Jacket length", "Back of neck to hem", 142, 230],
        ["Sleeve length", "Shoulder seam to wrist", 52, 205],
        ["Trouser waist", "Around the waist where the trouser sits", 122, 170],
        ["Trouser length", "Waist to ankle", 124, 340],
        ["Inseam", "Crotch to ankle", 100, 225],
      ],
    },
    {
      key: "dhoti",
      name: "Dhoti / Lungi",
      image: "/Images/dhoti-measurements.png",
      marks: [
        ["Waist", "Around the natural waist", 100, 150],
        ["Length", "Waist to ankle", 124, 340],
      ],
    },
  ],
};

function WomenSilhouette() {
  const skin = "#F4D9C6", garment = "#FBE3EF", st = "#111";
  return (
    <g stroke={st} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      {/* arms */}
      <line x1="72" y1="66" x2="52" y2="200" stroke={skin} strokeWidth="13" />
      <line x1="128" y1="66" x2="148" y2="200" stroke={skin} strokeWidth="13" />
      <line x1="72" y1="66" x2="52" y2="200" strokeWidth="2" fill="none" />
      <line x1="128" y1="66" x2="148" y2="200" strokeWidth="2" fill="none" />
      {/* head + neck */}
      <ellipse cx="100" cy="30" rx="15" ry="18" fill={skin} />
      <rect x="93" y="46" width="14" height="12" fill={skin} />
      {/* legs */}
      <path d="M88,295 L86,410 Q92,416 97,410 L99,295 Z" fill={skin} />
      <path d="M101,295 L103,410 Q108,416 113,410 L112,295 Z" fill={skin} />
      {/* bodice */}
      <path d="M70,62 Q100,52 130,62 L121,150 Q100,160 79,150 Z" fill={garment} />
      {/* A-line skirt */}
      <path d="M79,150 Q100,160 121,150 L158,300 Q100,320 42,300 Z" fill={garment} />
    </g>
  );
}

function MenSilhouette() {
  const skin = "#CFE9E4", garment = "#E0FAF7", st = "#111";
  return (
    <g stroke={st} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      {/* arms */}
      <line x1="64" y1="66" x2="50" y2="208" stroke={skin} strokeWidth="14" />
      <line x1="136" y1="66" x2="150" y2="208" stroke={skin} strokeWidth="14" />
      <line x1="64" y1="66" x2="50" y2="208" strokeWidth="2" fill="none" />
      <line x1="136" y1="66" x2="150" y2="208" strokeWidth="2" fill="none" />
      {/* head + neck */}
      <ellipse cx="100" cy="30" rx="15" ry="18" fill={skin} />
      <rect x="92" y="46" width="16" height="12" fill={skin} />
      {/* legs / pyjama */}
      <path d="M72,300 L70,412 Q77,418 83,412 L85,300 Z" fill={skin} />
      <path d="M115,300 L117,412 Q123,418 130,412 L128,300 Z" fill={skin} />
      {/* kurta / sherwani tunic */}
      <path d="M64,64 Q100,56 136,64 L131,302 L69,302 Z" fill={garment} />
    </g>
  );
}

function BodyDiagram({ gender, marks }) {
  return (
    <svg
      viewBox="0 0 200 430"
      style={{ width: "100%", maxWidth: 230, height: "auto", display: "block", margin: "0 auto" }}
      role="img"
      aria-label="Body diagram showing where each measurement is taken"
    >
      {gender === "women" ? <WomenSilhouette /> : <MenSilhouette />}
      {marks.map((m, i) => (
        <g key={i}>
          <circle cx={m[2]} cy={m[3]} r="12" fill={PINK} stroke="#111" strokeWidth="2" />
          <text
            x={m[2]}
            y={m[3]}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={BC}
            fontSize="15"
            fontWeight="800"
            fill="#fff"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

function NumBadge({ n }) {
  return (
    <span
      style={{
        flexShrink: 0,
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: PINK,
        color: "#fff",
        border: "2px solid #111",
        fontFamily: BC,
        fontSize: 13,
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
      }}
    >
      {n}
    </span>
  );
}

function GarmentSection({ gender, garment, open, onToggle }) {
  return (
    <div style={{ border: "2px solid #111", marginBottom: 14, background: "#fff" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          background: open ? "#111" : "#fff",
          border: "none",
          cursor: "pointer",
          fontFamily: BC,
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: 0.5,
          color: open ? "#fff" : "#111",
          textTransform: "uppercase",
        }}
        aria-expanded={open}
      >
        <span>{garment.name}</span>
        <span style={{ color: PINK, fontSize: 26, lineHeight: 1 }}>{open ? "–" : "+"}</span>
      </button>
      {open && (
        garment.image ? (
          <div style={{ padding: "20px 18px", borderTop: "2px solid #111" }}>
            <img
              src={garment.image}
              alt="How to measure a lehenga — waist, hip, lehenga length, blouse bust, blouse waist, blouse length"
              style={{ width: "100%", maxWidth: "800px", height: "auto", display: "block", margin: "0 auto" }}
            />
          </div>
        ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            padding: "20px 18px",
            borderTop: "2px solid #111",
          }}
        >
          <div style={{ flex: "1 1 200px", minWidth: 180, maxWidth: 260 }}>
            <BodyDiagram gender={gender} marks={garment.marks} />
          </div>
          <ol style={{ flex: "2 1 280px", listStyle: "none", margin: 0, padding: 0 }}>
            {garment.marks.map((m, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: i < garment.marks.length - 1 ? "1px solid #f0f0f0" : "none",
                }}
              >
                <NumBadge n={i + 1} />
                <span style={{ paddingTop: 1 }}>
                  <span style={{ fontFamily: BC, fontSize: 17, fontWeight: 800, color: "#111" }}>
                    {m[0]}
                  </span>
                  <span style={{ fontSize: 13.5, color: "#666", display: "block", lineHeight: 1.4 }}>
                    {m[1]}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        )
      )}
    </div>
  );
}

export default function MeasuringGuide() {
  const [gender, setGender] = useState("women");
  const [openKey, setOpenKey] = useState(GARMENTS.women[0].key);

  const switchGender = (g) => {
    setGender(g);
    setOpenKey(GARMENTS[g][0].key);
  };

  const list = GARMENTS[gender];

  const tabStyle = (active) => ({
    flex: 1,
    padding: "14px 12px",
    border: "2px solid #111",
    background: active ? PINK : "#fff",
    color: active ? "#fff" : "#111",
    fontFamily: BC,
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 3,
    cursor: "pointer",
    textTransform: "uppercase",
  });

  return (
    <div>
      {/* GENDER TOGGLE */}
      <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
        <button type="button" style={tabStyle(gender === "women")} onClick={() => switchGender("women")} aria-pressed={gender === "women"}>
          Women
        </button>
        <button type="button" style={tabStyle(gender === "men")} onClick={() => switchGender("men")} aria-pressed={gender === "men"}>
          Men
        </button>
      </div>

      {/* GARMENT SECTIONS */}
      <div style={{ marginBottom: 40 }}>
        {list.map((g) => (
          <GarmentSection
            key={g.key}
            gender={gender}
            garment={g}
            open={openKey === g.key}
            onToggle={() => setOpenKey(openKey === g.key ? null : g.key)}
          />
        ))}
      </div>
    </div>
  );
}

export function GeneralTips() {
  const tips = [
    "Always measure over lightweight clothing or underwear only",
    "Use a soft measuring tape — not a ruler",
    "Ask someone to help for shoulder and back measurements",
    "When in doubt, size up",
    "All measurements on Stitch'd are actual garment measurements unless stated otherwise",
  ];
  return (
    <div style={{ border: "2px solid #111", padding: "22px 22px 14px", marginBottom: 40, background: "#fff" }}>
      <h2 style={{ fontFamily: BC, fontSize: 26, fontWeight: 900, letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>
        General Tips
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {tips.map((t, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
            <span style={{ color: PINK, fontSize: 18, fontWeight: 900, lineHeight: 1.3, flexShrink: 0 }}>■</span>
            <span style={{ fontFamily: BC, fontSize: 16, fontWeight: 600, color: "#222", lineHeight: 1.35 }}>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
