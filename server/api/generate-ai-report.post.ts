import { defineEventHandler, readBody, createError, sendStream, setHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const rows = body.rows
  const chatHistory = body.chatHistory || []

  if (!rows || !Array.isArray(rows)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request: rows is required and must be an array'
    })
  }

  const config = useRuntimeConfig()
  const aiBaseUrl = config.aiBaseUrl
  const aiApiKey = config.aiApiKey

  if (!aiBaseUrl || !aiApiKey) {
    throw createError({
      statusCode: 500,
      message: 'AI configuration is missing'
    })
  }

  const systemPrompt = `
Anda adalah seorang asisten analitik yang membantu merangkum Product Backlog Item (PBI) menjadi laporan manajemen.
Anda HARUS selalu membalas dengan struktur berikut:
1. Penjelasan singkat yang ramah dan profesional mengenai tindakan yang Anda lakukan.
2. Diikuti dengan data laporan manajemen dalam format JSON yang dibungkus dengan markdown \`\`\`json.

Aturan Pembuatan Laporan JSON:
1. Baca dan analisa judul (title) serta deskripsi (description) dari setiap PBI. Kelompokkan PBI yang memiliki tujuan fungsional yang sama ke dalam 1 "Feature" yang merangkumnya dengan bahasa bisnis yang mudah dipahami oleh manajemen. Jangan sebutkan nomor PBI.
2. Jika ada PBI yang berdiri sendiri dan tidak dapat dikelompokkan, jadikan itu sebagai "Feature" tersendiri.
3. Tentukan "Platform" atau "Sistem" yang terdampak oleh fitur tersebut berdasarkan deskripsi atau judul (contoh: Shopify, Dashboard Member, API Mitra, dll). Jika tidak spesifik, isi dengan "-".
4. Tentukan "State" dari fitur tersebut:
   - "Released": Jika semua PBI dalam fitur tersebut sudah Released/Done.
   - "Blocking": Jika ada salah satu PBI yang berstatus Blocking (terlambat dari target).
   - "Processing": Jika PBI belum Released dan tidak ada yang Blocking.
5. Tentukan "Target": Ambil target sprint terjauh dari kelompok PBI tersebut (atau ikuti target yang ada).
6. Format JSON yang diharapkan HANYA berupa array of objects:
[
  {
    "feature": "Nama Fitur Hasil Rangkuman",
    "platform": "Nama Platform",
    "state": "Released | Blocking | Processing",
    "target": "DD MMM YYYY"
  }
]

Data PBI dasar yang akan dirangkum:
${JSON.stringify(rows.map((r: any) => ({ 
  title: r.feature, 
  description: (r.description || '').replace(/<[^>]*>?/gm, '').trim().substring(0, 500), // Limit description to 500 chars to avoid token limit overflow 
  state: r.state, 
  target: r.target 
})), null, 2)}
`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory
  ]

  try {
    const response = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`
      },
      body: JSON.stringify({
        model: config.aiModel || 'kantor-gemini',
        messages,
        temperature: 0.2,
        stream: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw createError({
        statusCode: response.status,
        message: 'Failed to fetch from AI server: ' + errorText
      })
    }

    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')

    return sendStream(event, response.body)
  } catch (error: any) {
    console.error('AI API Error:', error.message)
    throw createError({
      statusCode: 500,
      message: 'Gagal menghubungi server AI'
    })
  }
})
