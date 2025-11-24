// app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const authMiddleware = require("./middleware/auth");
const prisma = require("./lib/prisma");

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://minisimpensi.afif.dev"]
        : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.NODE_ENV !== "production") {
  app.use(express.static("."));
}

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    serverTime: new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
    }),
  });
});

if (process.env.NODE_ENV !== "production") {
  app.get("/api/config/google-client-id", (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "Google Client ID not configured" });
    }
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
  });
}

app.get("/", (req, res) => {
  res.send({
    name: "MiniSimpensi API",
    version: "1.0.0",
    description:
      "Project manager kita rasis, ada orang papua dipanggil Nigga bjir",
    github: "https://github.com/bukunya/Android-BE",
  });
});

// POST halaman profil
// DOSEN & MAHASISWA
// Update nama dan prodi.
app.post("/api/profile", authMiddleware, async (req, res) => {
  const { name, prodi } = req.body;

  if (
    !name ||
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.length > 100
  ) {
    return res.status(400).json({ error: "Nama harus 2-100 karakter" });
  }

  if (
    !prodi ||
    typeof prodi !== "string" ||
    prodi.trim().length < 2 ||
    prodi.length > 100
  ) {
    return res
      .status(400)
      .json({ error: "Program studi harus 2-100 karakter" });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name.trim(),
        prodi: prodi.trim(),
      },
    });
    res.json(updatedUser);
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Gagal mengupdate profil" });
  }
});

// GET halaman profil
// DOSEN & MAHASISWA
// Mendapatkan data profil sendiri.
app.get("/api/profile/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil data profil" });
  }
});

// POST halaman upload TA
// MAHASISWA
// Buat TA baru
app.post("/api/thesis", authMiddleware, async (req, res) => {
  if (req.user.role !== "MAHASISWA") {
    return res
      .status(403)
      .json({ error: "Hanya mahasiswa yang dapat mengajukan TA" });
  }

  const { title, docUrl } = req.body;

  // Input validation
  if (
    !title ||
    typeof title !== "string" ||
    title.trim().length < 10 ||
    title.length > 200
  ) {
    return res.status(400).json({ error: "Judul TA harus 10-200 karakter" });
  }

  if (
    !docUrl ||
    typeof docUrl !== "string" ||
    !docUrl.match(/^https?:\/\/.+/)
  ) {
    return res.status(400).json({ error: "URL dokumen tidak valid" });
  }

  try {
    const newThesis = await prisma.thesis.create({
      data: {
        title: title.trim(),
        docUrl: docUrl.trim(),
        studentId: req.user.id,
      },
    });

    res.status(201).json(newThesis);
  } catch (error) {
    console.error("Thesis creation error:", error);
    res.status(500).json({ error: "Gagal mengajukan TA" });
  }
});

// GET halaman dashboard dan semua TA
// MAHASISWA
// Menampilkan daftar semua TA mahasiswa.
app.get("/api/thesis/me/all", authMiddleware, async (req, res) => {
  if (req.user.role !== "MAHASISWA") {
    return res
      .status(403)
      .json({ error: "Hanya mahasiswa yang dapat melihat TA" });
  }

  try {
    const myThesis = await prisma.thesis.findMany({
      where: { studentId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(myThesis);
  } catch (error) {
    res.status(500).json({ error: "Error fetching data" });
  }
});

// GET halaman dashboard
// DOSEN
// Menampilkan 5 TA terbaru yang statusnya PENDING.
app.get("/api/dosen/pending", authMiddleware, async (req, res) => {
  if (req.user.role !== "DOSEN") return res.sendStatus(403);

  const pendingList = await prisma.thesis.findMany({
    where: { status: "PENDING" },
    include: { student: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  res.json(pendingList);
});

// GET halaman dashboard dan semua TA, pakai filter kalau mau nampilin yang spesifik jadi gak manggil API mulu
// DOSEN
// Menampilkan daftar semua TA.
app.get("/api/dosen/all", authMiddleware, async (req, res) => {
  if (req.user.role !== "DOSEN") return res.sendStatus(403);

  const allTheses = await prisma.thesis.findMany({
    include: { student: true },
    orderBy: { createdAt: "desc" },
  });

  res.json(allTheses);
});

// PUT halaman review TA
// DOSEN
// Review TA oleh dosen. Decision: APPROVED atau REJECTED atau PENDING.
app.put("/api/dosen/review/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "DOSEN") return res.sendStatus(403);

  const { id } = req.params;
  const { decision } = req.body;

  const validDecisions = ["APPROVED", "REJECTED", "PENDING"];
  if (!decision || !validDecisions.includes(decision)) {
    return res
      .status(400)
      .json({ error: "Decision harus APPROVED, REJECTED, atau PENDING" });
  }

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "ID TA tidak valid" });
  }

  try {
    const updated = await prisma.thesis.update({
      where: { id: id },
      data: { status: decision },
    });
    res.json(updated);
  } catch (error) {
    console.error("Thesis review error:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "TA tidak ditemukan" });
    }
    res.status(500).json({ error: "Update failed" });
  }
});

// GET halaman review TA dan jadwalkan TA
// DOSEN
// Mendapatkan detail TA tertentu untuk review.
app.get("/api/dosen/thesis/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "DOSEN") return res.sendStatus(403);

  const { id } = req.params;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "ID TA tidak valid" });
  }

  try {
    const thesis = await prisma.thesis.findUnique({
      where: { id: id },
      include: { student: true },
    });

    if (!thesis) {
      return res.status(404).json({ error: "Thesis not found" });
    }

    res.json(thesis);
  } catch (error) {
    console.error("Thesis detail fetch error:", error);
    res.status(500).json({ error: "Error fetching thesis details" });
  }
});

// PUT
// DOSEN
// Menjadwalkan TA oleh dosen.
app.put("/api/dosen/schedule/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "DOSEN") return res.sendStatus(403);

  const { id } = req.params;
  const { date } = req.body;

  // Input validation
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "ID TA tidak valid" });
  }

  if (!date || typeof date !== "string") {
    return res.status(400).json({ error: "Tanggal tidak valid" });
  }

  const scheduleDate = new Date(date);
  if (isNaN(scheduleDate.getTime())) {
    return res.status(400).json({ error: "Format tanggal tidak valid" });
  }

  if (scheduleDate <= new Date()) {
    return res.status(400).json({ error: "Tanggal harus di masa depan" });
  }

  try {
    const scheduled = await prisma.thesis.update({
      where: { id: id },
      data: {
        scheduledAt: scheduleDate,
        status: "APPROVED",
      },
    });
    res.json(scheduled);
  } catch (error) {
    console.error("Thesis scheduling error:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "TA tidak ditemukan" });
    }
    res.status(500).json({ error: "Scheduling failed" });
  }
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Middleware untuk error handling global
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

module.exports = app;
