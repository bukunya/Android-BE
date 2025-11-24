// middleware/auth.js
const { OAuth2Client } = require("google-auth-library");
const prisma = require("../lib/prisma");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

const authMiddleware = async (req, res, next) => {
  // --- BYPASS START ---
  //   req.user = {
  //     id: "999_test_dosen",
  //     email: "dosen@ugm.ac.id",
  //     name: "Dr. Dosen",
  //     role: "DOSEN",
  //   };
  //   return next();

  //   req.user = {
  //     id: "123_test_student",
  //     email: "test@mail.ugm.ac.id",
  //     name: "Budi Student",
  //     role: "MAHASISWA",
  //   };
  //   return next();
  // --- BYPASS END ---

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const googleUid = payload.sub;

    let role = "BLOCKED";

    // --- REAL UGM EMAIL CHECK ---
    // if (email.endsWith("@mail.ugm.ac.id")) {
    //   role = "MAHASISWA";
    // } else if (email.endsWith("@ugm.ac.id")) {
    //   role = "DOSEN";
    // } else {
    //   return res
    //     .status(403)
    //     .json({ error: "Akses Ditolak: Harap gunakan email UGM." });
    // }
    // --- REAL UGM EMAIL CHECK ---

    if (email.endsWith("@mail.ugm.ac.id")) {
      role = "DOSEN";
    } else {
      role = "MAHASISWA";
    }

    const user = await prisma.user.upsert({
      where: { id: googleUid },
      update: {
        email: email,
        name: payload.name,
        role: role,
      },
      create: {
        id: googleUid,
        email: email,
        name: payload.name,
        role: role,
      },
    });

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Error:", error.message);
    return res.status(401).json({ error: "Invalid Token" });
  }
};

module.exports = authMiddleware;
