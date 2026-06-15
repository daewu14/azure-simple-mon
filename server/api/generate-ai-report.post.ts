import { defineEventHandler, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const rows = body.rows

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

  const prompt = `
Anda adalah seorang asisten yang bertugas merangkum daftar Product Backlog Item (PBI) menjadi laporan manajemen.
Daftar PBI yang diberikan memiliki judul, state, dan target. Beberapa PBI mungkin ditujukan untuk mencapai satu fitur (goal) yang sama.
Tugas Anda:
1. Kelompokkan PBI yang memiliki tujuan yang sama ke dalam 1 "Feature" yang lebih mudah dibaca oleh manajemen. Jangan sebutkan nomor PBI.
2. Jika ada PBI yang berdiri sendiri, jadikan itu sebagai "Feature" dengan nama yang mudah dipahami.
3. Tentukan "State" dari fitur tersebut:
   - "Released": Jika semua PBI dalam fitur tersebut sudah Released/Done.
   - "Blocking": Jika ada salah satu PBI yang berstatus Blocking (terlambat dari target).
   - "Processing": Jika PBI belum Released dan tidak ada yang Blocking.
4. Tentukan "Target": Ambil target sprint terjauh dari kelompok PBI tersebut (atau ikuti target yang ada).

Berikan respons HANYA dalam bentuk JSON array of objects tanpa teks lain sama sekali (jangan gunakan format markdown seperti \`\`\`json).
Format JSON yang diharapkan:
[
  {
    "feature": "Nama Fitur Hasil Rangkuman",
    "state": "Released | Blocking | Processing",
    "target": "DD MMM YYYY"
  }
]

Data PBI saat ini:
${JSON.stringify(rows.map((r: any) => ({ title: r.feature, state: r.state, target: r.target })), null, 2)}
`

  try {
    const response: any = await $fetch(`${aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiApiKey}`
      },
      body: {
        model: 'kantor-gemini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that only outputs valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      }
    })

    let content = response?.choices?.[0]?.message?.content || '[]'
    
    // Clean up potential markdown blocks
    content = content.replace(/^```(json)?\n?/i, '').replace(/\n?```$/i, '')
    content = content.trim()

    let parsed = []
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      console.error('Failed to parse AI response:', content)
      throw createError({
        statusCode: 500,
        message: 'AI response was not valid JSON'
      })
    }

    return {
      success: true,
      data: parsed
    }
  } catch (error: any) {
    console.error('AI API Error:', error.message)
    throw createError({
      statusCode: 500,
      message: 'Gagal menghubungi server AI'
    })
  }
})
