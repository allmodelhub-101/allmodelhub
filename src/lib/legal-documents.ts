export type LegalDocumentKind = "terms" | "privacy" | "acceptable-use" | "refunds";

export type LegalSection = {
  id: string;
  title: string;
  summary: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type LegalDocument = {
  kind: LegalDocumentKind;
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  updated: string;
  highlights: readonly { title: string; detail: string }[];
  sections: readonly LegalSection[];
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentKind, LegalDocument> = {
  terms: {
    kind: "terms",
    title: "Terms of Service",
    shortTitle: "Terms",
    eyebrow: "The agreement in plain language",
    description: "The rules for using Models Suite, purchasing Credits, and working with third-party AI services through one account.",
    updated: "August 29, 2026",
    highlights: [
      { title: "Use responsibly", detail: "You are responsible for what you submit and how you use generated outputs." },
      { title: "Transparent Credits", detail: "One purchased Credit represents PKR 1 of platform spending value." },
      { title: "Provider-aware service", detail: "Availability and capabilities can vary across upstream AI providers." },
    ],
    sections: [
      {
        id: "using-models-suite",
        title: "Using Models Suite",
        summary: "What the platform provides and what you are responsible for.",
        paragraphs: [
          "Models Suite provides a unified interface for third-party and platform-operated AI services across text, image, video, and audio workflows. You are responsible for the prompts, files, instructions, and other content you submit, and for using generated outputs lawfully.",
          "You must provide accurate account information, keep your sign-in details secure, and use the service only for purposes permitted by these Terms and the Acceptable Use Policy.",
        ],
      },
      {
        id: "credits-and-billing",
        title: "Credits and billing",
        summary: "How platform spending value and request charges work.",
        paragraphs: [
          "One purchased Models Suite Credit represents PKR 1 of platform spending value. Purchased Credits do not expire under the current product policy. Promotional Credits may have separate eligibility, transfer, expiry, and abuse-prevention rules.",
          "AI requests can consume different amounts depending on the selected model, provider, input, output, and media settings. The amount shown in a completed billing receipt is the final charge for that operation.",
        ],
      },
      {
        id: "reservations-and-generations",
        title: "Reservations and generations",
        summary: "Why some requests temporarily reserve Credits before completion.",
        paragraphs: [
          "For variable-cost or higher-cost tasks, Models Suite may place a temporary Credit reservation before sending the request. A reservation is not a final charge. After processing, the applicable amount is captured and any unused reservation is released.",
          "Provider failures are handled according to the actual upstream billing outcome and the Credits & Refund Policy. Do not repeatedly submit a request while an earlier task is still processing unless the interface clearly permits it.",
        ],
      },
      {
        id: "third-party-models",
        title: "Third-party models",
        summary: "How upstream providers can affect the service.",
        paragraphs: [
          "Availability, capabilities, latency, output quality, safety controls, and content rules can depend on upstream AI providers. Models Suite may add, remove, reroute, restrict, or temporarily disable models to maintain reliability, compliance, or sustainable pricing.",
          "Generated outputs may be inaccurate, incomplete, or unsuitable for a particular purpose. Review important outputs before relying on them, especially for professional, financial, legal, medical, or safety-critical decisions.",
        ],
      },
      {
        id: "content-and-rights",
        title: "Your content and rights",
        summary: "Your responsibility for uploaded material and generated results.",
        paragraphs: [
          "You must have the rights and permissions needed to submit content to Models Suite. You retain any rights you already hold in your submitted content. Your content may be processed by the selected provider only as needed to deliver, secure, and support the requested service.",
          "Rights in AI-generated outputs can depend on applicable law, provider terms, and the material used to create them. Models Suite does not guarantee exclusivity or ownership of an output.",
        ],
      },
      {
        id: "account-security",
        title: "Account security",
        summary: "Protecting access to your account and wallet.",
        paragraphs: [
          "You must protect your account credentials and promptly contact Support if you suspect unauthorized access. You may not create accounts to abuse promotions, evade restrictions, interfere with the service, or avoid valid charges.",
          "We may restrict or suspend access when reasonably necessary to protect users, providers, the platform, or the integrity of billing and security systems.",
        ],
      },
      {
        id: "changes-and-contact",
        title: "Changes and contact",
        summary: "How updates are communicated and where to ask questions.",
        paragraphs: [
          "We may update these Terms when the product, supplier agreements, pricing structure, or legal requirements change. Material updates should be communicated through the service where appropriate. Continued use after an effective update means the updated Terms apply to future use.",
          "For questions about these Terms or your account, contact the Models Suite Support team through the Support page.",
        ],
      },
    ],
  },
  privacy: {
    kind: "privacy",
    title: "Privacy Policy",
    shortTitle: "Privacy",
    eyebrow: "Your data, explained clearly",
    description: "What information Models Suite processes, why it is needed, and the choices available when you use the platform.",
    updated: "August 29, 2026",
    highlights: [
      { title: "Only what is needed", detail: "Account, content, payment, and technical data used to operate the service." },
      { title: "Provider transparency", detail: "Requests may be sent to the selected AI provider to generate your result." },
      { title: "Meaningful controls", detail: "Manage conversations, preferences, and available account-data actions." },
    ],
    sections: [
      {
        id: "information-we-process",
        title: "Information we process",
        summary: "The information needed to provide and protect Models Suite.",
        paragraphs: [
          "The service can process account details, authentication data, wallet and payment records, prompts, files, conversations, generation settings, support requests, device and security signals, and product analytics needed to operate and secure the platform.",
          "The exact information processed depends on the features you use. For example, an image edit can require an uploaded image, while a manual payment review can require a transaction reference and payment proof.",
        ],
      },
      {
        id: "how-we-use-information",
        title: "How we use information",
        summary: "The purposes behind collection and processing.",
        paragraphs: [
          "We use information to authenticate users, deliver requested AI services, maintain conversations and generated assets, operate wallets and payments, prevent abuse, provide support, diagnose reliability issues, and improve the product.",
          "Security and audit information can be used to investigate suspicious activity, protect accounts, enforce platform rules, and maintain accurate financial records.",
        ],
      },
      {
        id: "ai-processing",
        title: "AI processing and providers",
        summary: "How your request reaches the model you select.",
        paragraphs: [
          "Prompts, attachments, and generation instructions may be sent to selected third-party AI infrastructure providers to fulfill your request. We do not promise that every request remains inside Models Suite infrastructure.",
          "Provider processing and retention practices can differ. Avoid including confidential or sensitive information unless it is necessary for your request and you are authorized to share it.",
        ],
      },
      {
        id: "payments",
        title: "Payments and wallet records",
        summary: "Information used to verify payments and maintain billing history.",
        paragraphs: [
          "Manual Easypaisa and Meezan Bank payment verification can require a transaction reference and uploaded payment proof. Payment and wallet records are retained as needed for accounting, fraud prevention, reconciliation, and support.",
          "Models Suite records request reservations, final captures, releases, and receipts so you can trace paid operations and the platform can investigate billing questions.",
        ],
      },
      {
        id: "security-and-retention",
        title: "Security and retention",
        summary: "How data is protected and how long it may remain available.",
        paragraphs: [
          "We use access controls, server-side secrets, private storage, and audit records designed to reduce unauthorized access. No online service can guarantee absolute security, so you should also protect your account and devices.",
          "Retention can differ by data type, business need, legal obligation, and provider. Download important generated media because upstream temporary URLs can expire even when a generation record remains in your account.",
        ],
      },
      {
        id: "your-controls",
        title: "Your controls",
        summary: "Ways to manage your account information and content.",
        paragraphs: [
          "Product features may allow you to delete chats, manage preferences, use temporary or private conversations, and request account-data actions. Some financial, security, fraud-prevention, or legal records may need to be retained.",
          "For privacy questions or an account-data request, contact Support. We may need to verify your identity before completing a request.",
        ],
      },
      {
        id: "changes-and-contact",
        title: "Changes and contact",
        summary: "Policy updates and privacy questions.",
        paragraphs: [
          "We may update this Privacy Policy as Models Suite, its providers, or applicable requirements change. The latest version and update date will remain available on this page.",
          "Contact the Models Suite Support team if you have a privacy question, security concern, or request relating to your account information.",
        ],
      },
    ],
  },
  "acceptable-use": {
    kind: "acceptable-use",
    title: "Acceptable Use Policy",
    shortTitle: "Acceptable use",
    eyebrow: "Create freely. Use responsibly.",
    description: "The safety rules that protect people, providers, and the Models Suite platform across text, image, video, and audio tools.",
    updated: "August 29, 2026",
    highlights: [
      { title: "Respect people", detail: "Do not exploit, harass, impersonate, or violate another person’s rights." },
      { title: "Use media with consent", detail: "Only use voices, faces, and files you have the right to provide." },
      { title: "Protect the platform", detail: "Do not bypass charging, safety controls, limits, or provider safeguards." },
    ],
    sections: [
      {
        id: "core-rule",
        title: "The core rule",
        summary: "Use Models Suite lawfully and without harming others.",
        paragraphs: [
          "Do not use Models Suite to facilitate illegal activity, fraud, unauthorized access, malware, sexual exploitation, non-consensual intimate content, dangerous wrongdoing, deceptive impersonation, harassment, or violations of another person’s rights.",
          "You are responsible for evaluating whether your intended use is lawful and appropriate. A model producing an output does not make that output safe, accurate, or permitted to use.",
        ],
      },
      {
        id: "people-and-safety",
        title: "People and safety",
        summary: "Uses that exploit, endanger, or seriously mislead people are prohibited.",
        paragraphs: [
          "Do not use the service to exploit minors, create non-consensual sexual material, plan serious harm, facilitate human trafficking, or target people with abusive or discriminatory conduct.",
          "Do not present generated material as authentic evidence, professional advice, or a real person’s statement when doing so is deceptive or likely to cause harm.",
        ],
      },
      {
        id: "media-and-voice",
        title: "Media, likeness, and voice",
        summary: "Consent and rights are required for uploaded or cloned media.",
        paragraphs: [
          "Only upload or clone voices, faces, images, recordings, and other media that you have the right and appropriate consent to use. Clearly disclose synthetic or edited media where context makes disclosure important to prevent deception.",
          "Additional provider restrictions can apply to specific generation models, public figures, biometric material, or realistic impersonation.",
        ],
      },
      {
        id: "security-and-fraud",
        title: "Security, fraud, and deception",
        summary: "Do not use AI tools to steal, defraud, or gain unauthorized access.",
        paragraphs: [
          "Do not create phishing material, malicious code, credential theft workflows, fraudulent documents, or instructions intended to bypass authorization or security controls.",
          "Research, education, and defensive security work must remain lawful, proportionate, and authorized by the system owner.",
        ],
      },
      {
        id: "platform-abuse",
        title: "Platform abuse",
        summary: "Models Suite and provider controls must not be bypassed.",
        paragraphs: [
          "Do not bypass wallet charging, rate limits, safety controls, promotion restrictions, model limits, geographic restrictions, or provider safeguards. Automated abuse, duplicate-account promotion farming, and attempts to extract secret credentials are prohibited.",
          "Do not interfere with service availability, probe private systems without authorization, or use generated traffic to degrade the experience for other users.",
        ],
      },
      {
        id: "enforcement",
        title: "Enforcement and reporting",
        summary: "How Models Suite responds to suspected misuse.",
        paragraphs: [
          "Requests can be blocked or reviewed, and accounts can be restricted or suspended when reasonably needed to protect users, providers, or the platform. Serious or repeated misuse can result in account closure.",
          "If you believe content or activity on Models Suite violates this policy, contact Support with enough detail for the issue to be reviewed safely.",
        ],
      },
    ],
  },
  refunds: {
    kind: "refunds",
    title: "Credits & Refund Policy",
    shortTitle: "Refunds",
    eyebrow: "Clear treatment for Credits and failed requests",
    description: "How purchased Credits, temporary reservations, provider failures, payment mistakes, and approved refunds are handled.",
    updated: "August 29, 2026",
    highlights: [
      { title: "Reservations are temporary", detail: "A hold protects a request budget; it is not the final customer charge." },
      { title: "Failures are investigated", detail: "Non-billable provider failures release the associated reservation." },
      { title: "Receipts create a trail", detail: "Completed paid operations should appear in wallet and usage history." },
    ],
    sections: [
      {
        id: "purchased-credits",
        title: "Purchased Credits",
        summary: "What Credits represent and when they become available.",
        paragraphs: [
          "Purchased Credits are added after successful payment verification and do not expire under the current product policy. They are platform spending value and are not a bank deposit, cash balance, or investment product.",
          "One purchased Credit represents PKR 1 of platform spending value. Credit availability can be delayed while a manual payment is being verified or a transaction requires additional review.",
        ],
      },
      {
        id: "reservations-and-final-charges",
        title: "Reservations and final charges",
        summary: "The difference between an authorization hold and a completed charge.",
        paragraphs: [
          "Some AI requests reserve Credits before the provider starts work. This reservation is not a final charge. When the result reaches a confirmed outcome, Models Suite captures the applicable final amount and releases any unused portion of the reservation.",
          "A completed billing receipt and wallet entry provide the transaction record for a paid operation. If a task remains pending unusually long, Support may reconcile it against provider evidence before finalizing the hold.",
        ],
      },
      {
        id: "failed-generations",
        title: "Failed or interrupted generations",
        summary: "How provider outcomes affect the final wallet treatment.",
        paragraphs: [
          "When a provider confirms a non-billable failure, reserved Credits are released and no final generation charge should remain. If an upstream provider bills a partially completed or interrupted request, the final platform treatment must reflect the applicable provider billing and the circumstances recorded for the generation.",
          "A browser closing, network interruption, or delayed callback does not by itself prove that a provider task failed. Models Suite may keep the reservation pending while the provider outcome is reconciled rather than releasing or capturing it without evidence.",
        ],
      },
      {
        id: "payment-mistakes",
        title: "Manual payment mistakes",
        summary: "What to do after a duplicate transfer or incorrect payment.",
        paragraphs: [
          "Duplicate transfers, incorrect amounts, and verification problems should be reported through Support with the payment order, transaction reference, and any requested proof. Do not publish payment evidence in a public message.",
          "Refunds to the original payment channel are handled manually when approved. Processing time can depend on verification and the payment provider.",
        ],
      },
      {
        id: "promotional-credits",
        title: "Promotional Credits",
        summary: "Different rules can apply to free or promotional value.",
        paragraphs: [
          "Promotional Credits are non-transferable, not withdrawable, and can have separate eligibility or expiry terms. They can be reversed when obtained through abuse, duplicate-account activity, or a promotion error.",
          "Unless a promotion states otherwise, promotional value is not refundable as cash and is used before or after purchased value according to the active promotion rules.",
        ],
      },
      {
        id: "requesting-review",
        title: "Requesting a billing review",
        summary: "The information that helps Support investigate quickly.",
        paragraphs: [
          "Contact Support if a completed request, wallet entry, or Credit purchase appears incorrect. Include the relevant date, model, generation or conversation reference, and payment reference where applicable.",
          "Models Suite may compare wallet records, billing receipts, request status, and provider evidence before resolving the review. Never send passwords, secret keys, or complete account credentials to Support.",
        ],
      },
    ],
  },
};
