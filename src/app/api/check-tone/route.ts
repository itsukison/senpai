import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here',
})

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 })
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a professional writing assistant that analyzes text for tone and professionalism. 

Your task is to:
1. Analyze the given text for aggressive, coercive, unprofessional, or disrespectful language
2. If issues are found, provide a more respectful, clear, and professional alternative
3. If the text is already professional, respond with null

Response format (JSON):
{
  "hasIssues": boolean,
  "originalText": "the original text",
  "suggestion": "improved version" or null,
  "issues": ["list of specific issues found"] or [],
  "reasoning": "brief explanation of changes"
}

Focus on:
- Removing aggressive or confrontational language
- Making requests more polite and respectful
- Clarifying ambiguous statements
- Improving overall professionalism
- Maintaining the original intent and meaning`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    })

    const response = completion.choices[0]?.message?.content
    
    if (!response) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    try {
      const parsedResponse = JSON.parse(response)
      return NextResponse.json(parsedResponse)
    } catch (parseError) {
      // Fallback if AI doesn't return valid JSON
      return NextResponse.json({
        hasIssues: false,
        originalText: text,
        suggestion: null,
        issues: [],
        reasoning: "Unable to parse AI response"
      })
    }

  } catch (error) {
    console.error('Error checking tone:', error)
    return NextResponse.json(
      { error: 'Failed to check tone' },
      { status: 500 }
    )
  }
} 