import { useState } from "react";
import jsPDF from "jspdf";
import "./App.css";

const stitchTypes = [
  { value: "sc", label: "Single crochet (sc)" },
  { value: "hdc", label: "Half double crochet (hdc)" },
  { value: "dc", label: "Double crochet (dc)" },
  { value: "tr", label: "Treble crochet (tr)" },
  { value: "sl st", label: "Slip stitch (sl st)" },
  { value: "inc", label: "Increase (inc)" },
  { value: "dec", label: "Decrease (dec)" },
  { value: "FPdc", label: "Front post double crochet (FPdc)" },
  { value: "BPdc", label: "Back post double crochet (BPdc)" },
  { value: "sc blo", label: "Single crochet back loop only (sc blo)" },
  { value: "sc flo", label: "Single crochet front loop only (sc flo)" },
];

const startingMethods = [
  { value: "none", label: "Regular round / row" },
  { value: "mr", label: "Magic ring (MR)" },
  { value: "ch", label: "Chain foundation" },
];

const initialRows = [
  {
    id: 1,
    method: "mr",
    count: 6,
    stitch: "sc",
    note: "Pull the yarn tail to close the ring.",
  },
  {
    id: 2,
    method: "none",
    count: 12,
    stitch: "inc",
    note: "Work 2 sc into each stitch around.",
  },
  {
    id: 3,
    method: "none",
    count: 18,
    stitch: "sc",
    note: "",
  },
];

const MAX_IMAGES = 3;

function numberOf(value) {
  return Math.max(0, Number(value) || 0);
}

function fileToSquareJpeg(file, maxSize = 900) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      const out = Math.min(maxSize, side);

      const canvas = document.createElement("canvas");
      canvas.width = out;
      canvas.height = out;

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out, out);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);

      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };

    img.src = url;
  });
}

function getRowInstruction(row, index) {
  const count = numberOf(row.count);
  const stitch = stitchTypes.find((item) => item.value === row.stitch);
  const abbreviation = stitch?.value ?? row.stitch;
  const name =
    stitch?.label.replace(` (${abbreviation})`, "") ?? row.stitch;

  if (row.method === "mr") {
    return `Round ${index + 1}: Make a magic ring. Work ${count} ${abbreviation} into the ring. (${count} sts)`;
  }

  if (row.method === "ch") {
    return `Row ${index + 1}: Chain ${count}, then work ${count} ${abbreviation} as specified in the pattern.`;
  }

  if (row.stitch === "inc") {
    return `Round ${index + 1}: Work ${count} increases (inc).`;
  }

  if (row.stitch === "dec") {
    return `Round ${index + 1}: Work ${count} decreases (dec).`;
  }

  if (row.stitch === "sl st") {
    return `Round ${index + 1}: Work ${count} slip stitches (sl st).`;
  }

  return `Round ${index + 1}: Work ${count} ${name.toLowerCase()} stitches (${abbreviation}).`;
}

function App() {
  const [title, setTitle] = useState("My Crochet Pattern");
  const [skill, setSkill] = useState("Beginner");
  const [yarn, setYarn] = useState("");
  const [hook, setHook] = useState("");
  const [gauge, setGauge] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState(initialRows);
  const [images, setImages] = useState([]);

  const updateRow = (id, field, value) => {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const addRow = () => {
    setRows((current) => [
      ...current,
      {
        id: Math.max(0, ...current.map((row) => row.id)) + 1,
        method: "none",
        count: 20,
        stitch: "sc",
        note: "",
      },
    ]);
  };

  const removeRow = (id) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const moveRow = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    setRows((current) => {
      const updated = [...current];
      [updated[index], updated[target]] = [
        updated[target],
        updated[index],
      ];
      return updated;
    });
  };

  const handleImages = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";

    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) return;

    const results = await Promise.allSettled(
      files.slice(0, slots).map((file) => fileToSquareJpeg(file))
    );

    const added = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        src: r.value,
      }));

    setImages((current) => [...current, ...added].slice(0, MAX_IMAGES));
  };

  const removeImage = (id) => {
    setImages((current) => current.filter((image) => image.id !== id));
  };

  const generatePDF = () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    const bottomMargin = 18;
    let y = 24;

    const olive = [79, 81, 53];
    const muted = [115, 115, 103];

    const ensureSpace = (height) => {
      if (y + height > pageHeight - bottomMargin) {
        pdf.addPage();
        y = margin;
      }
    };

    const writeText = (text, options = {}) => {
      const {
        size = 10,
        bold = false,
        color = [50, 50, 46],
        indent = 0,
      } = options;

      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(size);
      pdf.setTextColor(...color);

      const lines = pdf.splitTextToSize(
        String(text),
        contentWidth - indent
      );

      const lineHeight = size * 0.42;
      ensureSpace(lines.length * lineHeight + 3);
      pdf.text(lines, margin + indent, y);
      y += lines.length * lineHeight + 3;
    };

    const sectionHeading = (text) => {
      ensureSpace(15);
      y += 3;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(...olive);
      pdf.text(text, margin, y);
      y += 3;
      pdf.setDrawColor(218, 216, 205);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 7;
    };

    // Title
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(23);
    pdf.setTextColor(...olive);

    const titleLines = pdf.splitTextToSize(
      title.trim() || "Untitled Crochet Pattern",
      contentWidth
    );

    pdf.text(titleLines, pageWidth / 2, y, { align: "center" });
    y += titleLines.length * 10 + 2;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...muted);
    pdf.text("CROCHET PATTERN  ·  US TERMS", pageWidth / 2, y, {
      align: "center",
    });
    y += 12;

    // Images
    if (images.length > 0) {
      const gap = 4;
      const size = (contentWidth - gap * (MAX_IMAGES - 1)) / MAX_IMAGES;
      const rowWidth = images.length * size + (images.length - 1) * gap;
      const startX = (pageWidth - rowWidth) / 2;

      ensureSpace(size + 6);

      images.forEach((image, i) => {
        pdf.addImage(
          image.src,
          "JPEG",
          startX + i * (size + gap),
          y - 4,
          size,
          size
        );
      });

      y += size + 6;
    }

    // Pattern details
    sectionHeading("Pattern details");

    [
      ["Skill level", skill],
      ["Yarn", yarn || "Not specified"],
      ["Hook size", hook || "Not specified"],
      ["Gauge", gauge || "Not specified"],
    ].forEach(([label, value]) => {
      writeText(`${label}: ${value}`);
    });

    // Instructions
    sectionHeading("Pattern instructions");

    if (rows.length === 0) {
      writeText("No rounds or rows have been added yet.");
    }

    rows.forEach((row, index) => {
      const instruction = getRowInstruction(row, index);
      const note = row.note.trim() ? `Note: ${row.note.trim()}` : "";
      const combined = note ? `${instruction}\n${note}` : instruction;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);

      const lines = pdf.splitTextToSize(combined, contentWidth - 32);
      const lineHeight = 4.8;
      const cardHeight = Math.max(14, lines.length * lineHeight + 7);

      ensureSpace(cardHeight + 3);

      pdf.setFillColor(248, 247, 242);
      pdf.roundedRect(
        margin,
        y - 4,
        contentWidth,
        cardHeight,
        2,
        2,
        "F"
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...olive);
      pdf.text(
        `${row.method === "mr" ? "ROUND" : "ROW"} ${index + 1}`,
        margin + 4,
        y + 2
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(50, 50, 46);
      pdf.text(lines, margin + 29, y + 2);

      y += cardHeight + 3;
    });

    if (notes.trim()) {
      sectionHeading("Additional notes");
      writeText(notes.trim());
    }

    sectionHeading("US crochet abbreviations");

    const abbreviations = [
      "MR = Magic ring",
      "ch = Chain",
      ...stitchTypes.map((stitch) => {
        const fullName = stitch.label.replace(
          ` (${stitch.value})`,
          ""
        );
        return `${stitch.value} = ${fullName}`;
      }),
    ].join("   •   ");

    writeText(abbreviations, { size: 8, color: muted });

    // Page numbers
    const totalPages = pdf.getNumberOfPages();

    for (let page = 1; page <= totalPages; page++) {
      pdf.setPage(page);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(140, 140, 130);
      pdf.text(
        `${title.trim() || "Crochet Pattern"} · Page ${page} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 9,
        { align: "center" }
      );
    }

    const filename =
      (title.trim() || "crochet-pattern")
        .replace(/[^a-z0-9 -]/gi, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase() + ".pdf";

    pdf.save(filename);
  };

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Crochet Pattern Studio home">
          <span className="brand-icon">✳</span>
          <span>
            <strong>Crochet</strong>
            <small>PATTERN STUDIO</small>
          </span>
        </a>

        <button className="export-button" onClick={generatePDF}>
          ↓ Export PDF
        </button>
      </header>

      <main className="workspace">
        <section className="intro">
          <p className="eyebrow">YOUR NEXT HANDMADE PROJECT</p>
          <h1>
            Make a pattern
            <br />
            of your own.
          </h1>
          <p className="intro-copy">
            Build your crochet pattern row by row. Choose your stitch,
            set your count, and create a print-ready pattern using US terms.
          </p>
        </section>

        <div className="layout">
          <section className="editor-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">THE DETAILS</p>
                <h2>Pattern setup</h2>
              </div>
              <span className="step-tag">01</span>
            </div>

            <label className="field">
              <span>Pattern name</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Everyday crochet tote"
              />
            </label>

            <label className="field">
              <span>Skill level</span>
              <select
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
              >
                <option>Beginner</option>
                <option>Confident beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </label>

            <div className="field-row">
              <label className="field">
                <span>Yarn</span>
                <input
                  value={yarn}
                  onChange={(e) => setYarn(e.target.value)}
                  placeholder="e.g. Worsted cotton"
                />
              </label>

              <label className="field">
                <span>Hook size</span>
                <input
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                  placeholder="e.g. 5 mm / H-8"
                />
              </label>
            </div>

            <label className="field">
              <span>Gauge <small>optional</small></span>
              <input
                value={gauge}
                onChange={(e) => setGauge(e.target.value)}
                placeholder="e.g. 16 sc × 18 rows = 4 in"
              />
            </label>

            <div className="field photos-field">
              <span>
                Photos <small>optional · up to {MAX_IMAGES}</small>
              </span>

              {images.length > 0 && (
                <div className="photo-thumbs">
                  {images.map((image, index) => (
                    <div className="photo-thumb" key={image.id}>
                      <img src={image.src} alt={`Pattern photo ${index + 1}`} />
                      <button
                        type="button"
                        title="Remove photo"
                        aria-label={`Remove photo ${index + 1}`}
                        onClick={() => removeImage(image.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {images.length < MAX_IMAGES && (
                <label className="add-row-button upload-button">
                  <span>＋</span> Add photo
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImages}
                    hidden
                  />
                </label>
              )}
            </div>

            <div className="divider" />

            <div className="panel-heading rows-heading">
              <div>
                <p className="eyebrow">THE PATTERN</p>
                <h2>Build your rows</h2>
              </div>
              <span className="step-tag">02</span>
            </div>

            <p className="helper-text">
              Choose a starting method for each row or round. For a magic
              ring, choose MR and then select the stitch worked into it.
            </p>

            <div className="row-editor-list">
              {rows.map((row, index) => (
                <article className="row-card" key={row.id}>
                  <div className="row-card-top">
                    <span className="row-index">
                      {row.method === "mr" ? "STARTING ROUND" : `ROW ${String(index + 1).padStart(2, "0")}`}
                    </span>

                    <div className="row-actions">
                      <button
                        type="button"
                        title="Move row up"
                        aria-label={`Move row ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => moveRow(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        title="Move row down"
                        aria-label={`Move row ${index + 1} down`}
                        disabled={index === rows.length - 1}
                        onClick={() => moveRow(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="remove-row"
                        title="Remove row"
                        aria-label={`Remove row ${index + 1}`}
                        onClick={() => removeRow(row.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <label className="field">
                    <span>Starting method</span>
                    <select
                      value={row.method}
                      onChange={(e) =>
                        updateRow(row.id, "method", e.target.value)
                      }
                    >
                      {startingMethods.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="field-row row-fields">
                    <label className="field">
                      <span>
                        {row.method === "mr"
                          ? "Stitches into ring"
                          : row.method === "ch"
                            ? "Chain count"
                            : "Stitch count"}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={row.count}
                        onChange={(e) =>
                          updateRow(row.id, "count", e.target.value)
                        }
                      />
                    </label>

                    <label className="field stitch-field">
                      <span>
                        {row.method === "mr" ? "Stitch to work" : "Stitch type"}
                      </span>
                      <select
                        value={row.stitch}
                        onChange={(e) =>
                          updateRow(row.id, "stitch", e.target.value)
                        }
                      >
                        {stitchTypes.map((stitch) => (
                          <option key={stitch.value} value={stitch.value}>
                            {stitch.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {row.method === "mr" && (
                    <p className="magic-ring-hint">
                      Make an adjustable loop, work the selected stitches
                      into it, then pull the yarn tail to close the ring.
                    </p>
                  )}

                  {row.method === "ch" && (
                    <p className="magic-ring-hint">
                      Creates a chain foundation. Add a note to explain
                      where to work the next row.
                    </p>
                  )}

                  <label className="field note-field">
                    <span>Row note <small>optional</small></span>
                    <input
                      value={row.note}
                      onChange={(e) =>
                        updateRow(row.id, "note", e.target.value)
                      }
                      placeholder="e.g. Join with a slip stitch"
                    />
                  </label>
                </article>
              ))}
            </div>

            <button className="add-row-button" onClick={addRow}>
              <span>＋</span> Add another row
            </button>

            <div className="divider" />

            <label className="field">
              <span>Additional notes <small>optional</small></span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="3"
                placeholder="Finishing instructions, special tips, or assembly notes..."
              />
            </label>
          </section>

          <section className="preview-column">
            <div className="preview-heading">
              <div>
                <p className="eyebrow">A WORK IN PROGRESS</p>
                <h2>Pattern preview</h2>
              </div>
              <span className="live-label">
                <span /> LIVE
              </span>
            </div>

            <article className="paper">
              <div className="paper-topline">
                <span>CROCHET PATTERN</span>
                <span>US TERMS</span>
              </div>

              <div className="paper-title">
                <div className="decorative-flower">✳</div>
                <h2>{title.trim() || "Untitled Pattern"}</h2>
                <p>{skill} · CROCHET PATTERN</p>
              </div>

              {images.length > 0 && (
                <div className="paper-images">
                  {images.map((image, index) => (
                    <img
                      key={image.id}
                      src={image.src}
                      alt={`Pattern photo ${index + 1}`}
                    />
                  ))}
                </div>
              )}

              <div className="paper-details">
                <div>
                  <span>YARN</span>
                  <strong>{yarn.trim() || "Not specified"}</strong>
                </div>
                <div>
                  <span>HOOK</span>
                  <strong>{hook.trim() || "Not specified"}</strong>
                </div>
                <div>
                  <span>GAUGE</span>
                  <strong>{gauge.trim() || "Not specified"}</strong>
                </div>
              </div>

              <section className="paper-section">
                <div className="paper-section-title">
                  <span>01</span>
                  <h3>Pattern instructions</h3>
                </div>

                <div className="preview-rows">
                  {rows.length === 0 && (
                    <p className="empty-rows">
                      Add a row to begin your pattern.
                    </p>
                  )}

                  {rows.map((row, index) => (
                    <div className="preview-row" key={row.id}>
                      <span className="preview-row-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p>{getRowInstruction(row, index)}</p>
                        {row.note.trim() && <small>{row.note}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {notes.trim() && (
                <section className="paper-section">
                  <div className="paper-section-title">
                    <span>02</span>
                    <h3>Additional notes</h3>
                  </div>
                  <p className="paper-notes">{notes}</p>
                </section>
              )}

              <section className="abbreviation-box">
                <h3>US crochet abbreviations</h3>
                <p>
                  MR · Magic ring /{" "}
                  {stitchTypes
                    .map((stitch) => {
                      const fullName = stitch.label.replace(
                        ` (${stitch.value})`,
                        ""
                      );
                      return `${stitch.value} · ${fullName}`;
                    })
                    .join(" / ")}
                </p>
              </section>

              <footer className="paper-footer">
                <span>MADE BY HAND, WITH LOVE</span>
                <span>
                  {rows.length} {rows.length === 1 ? "ROW" : "ROWS"}
                </span>
              </footer>
            </article>

            <div className="preview-tip">
              <span>✦</span>
              <p>
                <strong>Ready when you are.</strong>
                Your PDF includes your pattern details, instructions,
                optional notes, and a US abbreviation reference.
              </p>
            </div>

            <button
              className="export-button export-bottom"
              onClick={generatePDF}
            >
              ↓ Export your pattern as PDF
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
