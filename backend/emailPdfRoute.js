// /api/email-pdf endpoint for emailing PDF results
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const multer = require('multer');
const upload = multer();

// POST /api/email-pdf
router.post('/', upload.single('pdf'), async (req, res) => {
  const { email } = req.body;
  const pdfBuffer = req.file && req.file.buffer;
  if (!email || !pdfBuffer) {
    return res.status(400).json({ error: 'Missing email or PDF file' });
  }
  try {
    // Configure nodemailer (use your SMTP or a service like Gmail, SendGrid, etc.)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'DTH Medal Results PDF',
      text: 'Attached are the requested DTH Medal Results.',
      attachments: [
        {
          filename: 'results.pdf',
          content: pdfBuffer,
        },
      ],
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
