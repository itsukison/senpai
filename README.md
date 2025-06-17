# ToneCheck - Professional Writing Assistant

A beautiful, Spotify-inspired Next.js application that helps you write with better tone and professionalism. Like Grammarly, but focused specifically on tone, respect, and clarity.

## Features

- 🎯 **Real-time tone analysis** - Analyzes your writing as you type
- 🤖 **AI-powered suggestions** - Uses OpenAI API to provide professional alternatives
- 💬 **Floating suggestions** - Grammarly-style popup suggestions
- 🎨 **Beautiful UI** - Spotify-inspired dark theme with smooth animations
- ⚡ **Fast & responsive** - Built with Next.js 14 and Tailwind CSS
- 🔄 **One-click accept** - Easy suggestion acceptance and text replacement

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

   Edit `.env.local` and add your OpenAI API key:

   ```
   OPENAI_API_KEY=your-actual-openai-api-key-here
   ```

3. **Run the development server**

   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Start typing** in the large text area
2. **Wait for analysis** - The app analyzes your text after a 1-second pause
3. **Review suggestions** - If tone issues are detected, a popup will appear
4. **Accept or dismiss** - Click "Accept Suggestion" to replace your text, or "Ignore" to dismiss

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-3.5-turbo
- **Language**: TypeScript
- **Deployment**: Ready for Vercel, Netlify, or any Node.js hosting

## API Configuration

### OpenAI (Default)

The app uses OpenAI's GPT-3.5-turbo model by default. Set your API key in `.env.local`:

```
OPENAI_API_KEY=your-openai-api-key
```

### DeepSeek (Alternative)

To use DeepSeek instead, modify `src/app/api/check-tone/route.ts` and update the API configuration.

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

Change the debounce delay in `src/components/ToneChecker.tsx` (currently 1000ms).

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
2. Ensure you have sufficient API credits
3. Verify your internet connection for API calls

---

**Built with ❤️ for better communication**
