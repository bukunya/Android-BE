// app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const authMiddleware = require("./middleware/auth");
const prisma = require("./lib/prisma");

const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/thesis", authMiddleware, async (req, res) => {
  if (req.user.role !== "MAHASISWA") {
    return res.status(403).json({ error: "Only students can submit thesis" });
  }

  const { title, docUrl, prodi } = req.body;

  try {
    if (prodi) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { prodi },
      });
    }

    const newThesis = await prisma.thesis.create({
      data: {
        title,
        docUrl,
        studentId: req.user.id,
      },
    });

    res.json(newThesis);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to submit thesis" });
  }
});

app.get("/api/thesis/me", authMiddleware, async (req, res) => {
  try {
    const myThesis = await prisma.thesis.findFirst({
      where: { studentId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(myThesis);
  } catch (error) {
    res.status(500).json({ error: "Error fetching data" });
  }
});

app.get("/api/dosen/pending", authMiddleware, async (req, res) => {
  if (req.user.role !== "DOSEN") return res.sendStatus(403);

  const pendingList = await prisma.thesis.findMany({
    where: { status: "PENDING" },
    include: { student: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  res.json(pendingList);
});

app.get("/api/dosen/scheduled", authMiddleware, async (req, res) => {
  if (req.user.role !== "DOSEN") return res.sendStatus(403);

  const scheduledList = await prisma.thesis.findMany({
    where: {
      status: "APPROVED",
      scheduledAt: { not: null },
    },
    include: { student: true },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });
  res.json(scheduledList);
});

app.put("/api/dosen/review/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "DOSEN") return res.sendStatus(403);

  const { id } = req.params;
  const { decision } = req.body;

  try {
    const updated = await prisma.thesis.update({
      where: { id: parseInt(id) },
      data: { status: decision },
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: "Update failed" });
  }
});

app.put("/api/dosen/schedule/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "DOSEN") return res.sendStatus(403);

  const { id } = req.params;
  const { date } = req.body;

  try {
    const scheduled = await prisma.thesis.update({
      where: { id: parseInt(id) },
      data: {
        scheduledAt: new Date(date),
        status: "APPROVED",
      },
    });
    res.json(scheduled);
  } catch (error) {
    res.status(400).json({ error: "Scheduling failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
