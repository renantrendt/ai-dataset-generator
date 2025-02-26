const entries = [
    {
        "word": "ahë",
        "translation": "yours",
        "grammar": "Pronoun",
        "related_forms": [],
        "examples": [
            {
                "yanomami": "ahë a ta mahipa",
                "translation": "lend me yours"
            },
            {
                "yanomami": "ahë a ma rë kui",
                "translation": "however this is yours"
            },
            {
                "yanomami": "ahë kë a shereka",
                "translation": "this arrow is yours"
            }
        ]
    },
    {
        "word": "ahete",
        "translation": "to approach, to get closer",
        "grammar": "Verb (Intransitive)",
        "related_forms": [],
        "examples": []
    }
];

const jsonlEntries = entries.map(entry => ({
    messages: [
        {
            role: 'user',
            content: `What does '${entry.word}' mean in Yanomami?`
        },
        {
            role: 'assistant',
            content: `The word '${entry.word}' in Yanomami means '${entry.translation}'. It is ${entry.grammar === 'Noun' || /^[aeiou]/i.test(entry.grammar) ? 'an' : 'a'} ${entry.grammar}.${entry.examples.length > 0 ? `\n\nHere are some examples:\n\n${entry.examples.map(ex => `- ${ex.yanomami}\n  Translation: ${ex.translation}`).join('\n\n')}` : ''}${entry.related_forms && entry.related_forms.length > 0 ? `\n\nRelated forms: ${entry.related_forms.join(', ')}` : ''}`
        }
    ]
}));

console.log(JSON.stringify(jsonlEntries, null, 4));
