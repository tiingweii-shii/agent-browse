const HUMAN_EXAMPLES = [
  'Summarize my open Jira tickets',
  'Go to LinkedIn and draft a post about today\'s release',
  'Compare prices for flights to Tokyo next week',
];

const AGENT_EXAMPLES = [
  'Check the staging deployment for errors',
  'Fill out this form with my details',
  'Read the docs and summarize the setup steps',
];

export function EmptyState({ onSelectExample, primaryMode }) {
  const examples = primaryMode === 'agent' ? AGENT_EXAMPLES : HUMAN_EXAMPLES;

  return (
    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="currentColor" />
          <g stroke="var(--bg-primary)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="10.5" cy="10.5" r="5.5" />
            <path d="M5 10.5h11M10.5 5c2 2 2 9 0 11M10.5 5c-2 2-2 9 0 11" />
            <circle cx="13" cy="13" r="4" fill="currentColor" />
            <path d="M16 16l3 3" />
          </g>
        </svg>
      </div>
      <h2>What should we browse?</h2>
      <p>Tell the agent what to do and it will take over the browser.</p>
      <div class="empty-examples">
        {examples.map((example, i) => (
          <button
            key={i}
            class="example-chip"
            onClick={() => onSelectExample(example)}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
