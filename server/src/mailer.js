const { Resend } = require('resend')

const resend = new Resend(process.env.RESEND_API_KEY)

async function sendVerificationCode(email, code) {
  const { error } = await resend.emails.send({
    from: 'CocoDack <onboarding@resend.dev>',
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
  if (error) throw new Error(error.message)
  console.log('Email sent to', email)
}

module.exports = { sendVerificationCode }
