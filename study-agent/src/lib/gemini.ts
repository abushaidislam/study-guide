import { GoogleGenerativeAI } from '@google/generative-ai'

export function getStudyAgentModel() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const genAI = new GoogleGenerativeAI(apiKey)
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  return genAI.getGenerativeModel({
    model: modelName,
    // System instruction guides the agent behavior
    systemInstruction: `You are Study Flow Agent. \n
- Plan study routines, create daily tasks, and help with scheduling.\n- Default language: Bangla (unless the user writes in English).\n- Be concise and actionable.\n- When suggesting schedules, use 25–50 minute focused blocks with short breaks.\n- Consider deadlines and priorities when asked to plan.\n- If asked to generate Q&A or flashcards, keep them short and clear.`,
  })
}
