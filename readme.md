# 🔬 ABU Health Analyzer

AI-powered tongue analysis with personalized supplement recommendations using Claude AI.

## 🚀 Quick Deploy

### Option 1: Fork & Deploy (Recommended)
1. **Fork this repository** to your GitHub account
2. **Connect to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Click "New site from Git"
   - Choose your forked repository
   - Deploy automatically!
3. **Get Claude API key:**
   - Visit [console.anthropic.com](https://console.anthropic.com)
   - Create an API key (starts with `sk-ant-`)
   - Add minimum $5 balance
4. **Use the analyzer:**
   - Open your deployed site
   - Enter API key
   - Upload tongue photo
   - Get AI analysis!

### Option 2: Manual Deploy
1. Download this repository
2. Upload to Netlify via drag & drop
3. Functions should auto-deploy

## 🔧 Local Development

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Clone repository
git clone https://github.com/yourusername/abu-health-analyzer.git
cd abu-health-analyzer

# Start local development
netlify dev
```

## 📁 Project Structure

```
abu-health-analyzer/
├── index.html              # Main application
├── netlify/functions/       # Serverless functions
│   └── claude.js           # Claude API proxy
├── package.json            # Dependencies
├── netlify.toml            # Netlify configuration
└── README.md               # This file
```

## 🔐 Security Features

- **Medical Safety Checks:** Detects concerning symptoms requiring doctor consultation
- **API Key Protection:** Keys never stored, only used in serverless functions
- **CORS Handling:** Secure cross-origin requests
- **Input Validation:** All inputs validated and sanitized

## 🏥 Medical Disclaimer

⚠️ **This is NOT medical diagnosis software.**

- For wellness guidance only
- Always consult healthcare professionals
- System flags concerning symptoms for medical review
- Supplements are not medicine

## 🛠️ Technical Details

### Stack
- **Frontend:** Pure HTML/CSS/JavaScript
- **AI:** Claude 3 Sonnet (Anthropic)
- **Backend:** Netlify Functions (Node.js)
- **Hosting:** Netlify (free tier)

### API Integration
- Secure proxy through Netlify Functions
- Anthropic Claude API v1
- Image analysis with base64 encoding
- Structured JSON responses

### Features
- Traditional Chinese Medicine (TCM) zone analysis
- "Red flag" detection for medical referral
- Personalized ABU supplement recommendations
- Mobile-responsive design

## 🔍 How It Works

1. **Image Upload:** User uploads tongue photo
2. **AI Analysis:** Claude AI analyzes using TCM principles
3. **Safety Check:** System checks for concerning symptoms
4. **Recommendations:** If safe, provides wellness suggestions
5. **Medical Alert:** If concerning, recommends doctor consultation

## 📊 Testing

The system includes comprehensive testing:
- Function validation
- API response handling
- Error scenarios
- Security checks

## 🌍 Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 📞 Support

For technical issues:
1. Check browser console for errors
2. Verify API key is valid
3. Ensure stable internet connection
4. Try different browser if needed

## 📄 License

MIT License - see LICENSE file for details.