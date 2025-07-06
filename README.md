# ToneCheck - Professional Writing Assistant

A beautiful, Spotify-inspired Next.js application that helps you write with better tone and professionalism. Like Grammarly, but focused specifically on tone, respect, and clarity.

## Features

- 🎯 **Real-time tone analysis** - Analyzes your writing as you type
- 🤖 **AI-powered suggestions** - Uses OpenAI API to provide professional alternatives
- 💬 **Floating suggestions** - Grammarly-style popup suggestions
- 🎨 **Beautiful UI** - Spotify-inspired dark theme with smooth animations
- ⚡ **Fast & responsive** - Built with Next.js 14 and Tailwind CSS
- 🔄 **One-click accept** - Easy suggestion acceptance and text replacement
- 💾 **Data tracking** - Saves analysis results to Supabase database

## Demo

The app analyzes text for:

- Aggressive or confrontational language
- Unprofessional tone
- Coercive language
- Unclear communication

And suggests more respectful, clear, and professional alternatives.

## Getting Started

### Prerequisites

- Node.js 18+
- An OpenAI API key
- A Supabase account and project

### Installation

1. **Clone and setup**

   ```bash
   git clone <your-repo>
   cd tone-checker
   npm install
   ```

2. **Environment setup**

   ```bash
   cp env.example .env.local
   ```

   Edit `.env.local` and add your API keys:

   ```
   OPENAI_API_KEY=your-actual-openai-api-key-here
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Database Setup (Supabase)**

   Create a table called `history` in your Supabase project with the following schema:

   ```sql
   CREATE TABLE history (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     input TEXT NOT NULL,
     feedback TEXT,
     hierarchy VARCHAR(50),
     social_distance VARCHAR(50),
     language VARCHAR(20),
     thread_context TEXT,
     issue_pattern JSONB,
     has_issue BOOLEAN,
     improvement_points TEXT,
     detailed_analysis TEXT
   );
   ```

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Start typing** in the large text area
2. **Wait for analysis** - The app analyzes your text after a 3-second pause
3. **Review suggestions** - If tone issues are detected, a popup will appear
4. **Accept or dismiss** - Click "Accept Suggestion" to replace your text, or "Ignore" to dismiss
5. **Data tracking** - All analyses are automatically saved to your Supabase database

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4.1-mini
- **Database**: Supabase
- **Language**: TypeScript
- **Deployment**: Ready for Vercel, Netlify, or any Node.js hosting

## API Configuration

### OpenAI (Default)

The app uses OpenAI's GPT-4.1-mini model by default. Set your API key in `.env.local`:

```
OPENAI_API_KEY=your-openai-api-key
```

### Supabase Database

Set up your Supabase connection in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### DeepSeek (Alternative)

To use DeepSeek instead, modify `src/app/api/check-tone/route.ts` and update the API configuration.

## Database Schema

The application tracks the following data for each analysis:

- **User input**: Original text entered by the user
- **AI feedback**: Suggested improvements from the AI
- **Context settings**: Hierarchy (peer/senior/junior) and social distance
- **Analysis results**: Issue patterns, improvement points, detailed analysis
- **Timestamps**: When record was created (auto-generated)

## Troubleshooting

### Database Issues

If you're experiencing database insertion problems:

1. **Check your environment variables** - Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly
2. **Check the browser console** - Look for Supabase connection test results
3. **Verify your Supabase table schema** - Ensure all required columns exist
4. **Check Supabase logs** - Review your Supabase dashboard for error details

### Common Error Messages

- "Missing Supabase environment variables" - Add the required environment variables to your `.env.local` file
- "Database error: [message]" - Check your Supabase table schema and permissions
- "Connection test failed" - Verify your Supabase URL and API key

## Customization

### Modify the AI Prompt

Edit the system prompt in `src/app/api/check-tone/route.ts` to change how the AI analyzes text.

### Styling

The app uses a Spotify-inspired theme defined in `tailwind.config.js`. Customize the colors:

- `spotify-green`: Primary accent color
- `spotify-black`: Main background
- `spotify-darkgray`: Card backgrounds
- `spotify-lightgray`: Secondary backgrounds

### Analysis Delay

Change the debounce delay in `src/components/ToneChecker.tsx` (currently 3000ms).

## Deployment

### Vercel (Recommended)

```bash
npm run build
vercel --prod
```

### Other Platforms

The app is a standard Next.js application and can be deployed anywhere that supports Node.js.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

If you encounter any issues:

1. Check that your OpenAI API key is correctly set
2. Verify your Supabase configuration and database schema
3. Ensure you have sufficient API credits
4. Check the browser console for detailed error messages
5. Review your internet connection for API calls

---

**Built with ❤️ for better communication**
