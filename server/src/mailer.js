const https = require('https')

async function sendVerificationCode(email, code) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY not set')

  const body = JSON.stringify({
    sender: { name: 'CocoDack', email: process.env.BREVO_SENDER || 'kpthelp1@gmail.com' },
    to: [{ email }],
    subject: 'Подтверждение email — CocoDack',
    htmlContent: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;background:#17212B;border-radius:16px;color:#fff">
        <h2 style="margin:0 0 16px">CocoDack</h2>
        <p style="color:#aaa;margin:0 0 24px">Твой код подтверждения:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#232E3C;border-radius:12px">${code}</div>
        <p style="color:#aaa;margin:24px 0 0;font-size:12px">Код действителен 10 минут.</p>
      </div>
    `
  })

  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 10000
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('Email sent to', email)
          resolve(data)
        } else {
          reject(new Error(`Brevo error ${res.statusCode}: ${data}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Email request timed out')) })
    req.write(body)
    req.end()
  })
}

module.exports = { sendVerificationCode }
