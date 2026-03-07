import { motion } from "framer-motion";
import { useState } from "react";

const tabs = ["TypeScript", "Python", "cURL", "React"];

const codeSnippets: Record<string, string> = {
  TypeScript: `import { ISIBIClient } from '@isibi/sdk';

const client = new ISIBIClient({
  apiKey: 'YOUR_API_KEY'
});

async function createCall() {
  const call = await client.calls.create({
    phoneNumberId: 'YOUR_PHONE_NUMBER_ID',
    customer: { number: '+1234567890' },
    assistant: {
      model: { provider: 'openai', model: 'gpt-4o' },
      voice: { provider: 'elevenlabs' }
    }
  });
  console.log('Call started:', call.id);
}`,
  Python: `from isibi import ISIBIClient

client = ISIBIClient(api_key="YOUR_API_KEY")

call = client.calls.create(
    phone_number_id="YOUR_PHONE_NUMBER_ID",
    customer={"number": "+1234567890"},
    assistant={
        "model": {"provider": "openai", "model": "gpt-4o"},
        "voice": {"provider": "elevenlabs"}
    }
)
print(f"Call started: {call.id}")`,
  cURL: `curl -X POST https://api.isibi.ai/calls \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phoneNumberId": "YOUR_PHONE_NUMBER_ID",
    "customer": { "number": "+1234567890" },
    "assistant": {
      "model": { "provider": "openai" },
      "voice": { "provider": "elevenlabs" }
    }
  }'`,
  React: `import { useVoiceAgent } from '@isibi/react';

function VoiceButton() {
  const { start, stop, isActive } = useVoiceAgent({
    assistantId: 'YOUR_ASSISTANT_ID',
    onMessage: (msg) => console.log(msg)
  });

  return (
    <button onClick={isActive ? stop : start}>
      {isActive ? 'End Call' : 'Start Call'}
    </button>
  );
}`,
};

export function CodeSection() {
  const [activeTab, setActiveTab] = useState("TypeScript");

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-secondary/20">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Making voice AI <span className="gradient-text">simple</span>
            <br />
            and accessible.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-card rounded-2xl overflow-hidden"
        >
          {/* Tab bar */}
          <div className="flex border-b border-border/50 bg-card/50">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="p-6 overflow-x-auto">
            <pre className="text-sm text-foreground/90 font-mono leading-relaxed">
              <code>{codeSnippets[activeTab]}</code>
            </pre>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
