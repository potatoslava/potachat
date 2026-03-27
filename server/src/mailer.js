const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'kpthelp1@gmail.com',
    pass: 'bxadhhxhjzhteuyy'
  },
  tls: { rejectUnauthorized: false },
  family: 4  // принудительно IPv4
})

async function sendVerificationCode(email, code) {
  const info = await transporter.sendMail({
    from: '"CocoDack" <kpthelp1@gmail.com>',
    to: email,
    subject: 'Подтверждение email — CocoDack',
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;background:#17212B;border-radius:16px;color:#fff">
        <h2 style="margin:0 0 16px">CocoDack</h2>
        <p style="color:#aaa;margin:0 0 24px">Твой код подтверждения:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#232E3C;border-radius:12px">${code}</div>
        <p style="color:#aaa;margin:24px 0 0;font-size:12px">Код действителен 10 минут.</p>
      </div>
    `
  })
  console.log('Email sent:', info.messageId)
}

module.exports = { sendVerificationCode }
