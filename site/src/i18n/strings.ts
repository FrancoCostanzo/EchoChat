export type Lang = 'es' | 'en' | 'pt';
export type Page = 'home' | 'faq';

export const LANGS: Lang[] = ['es', 'en', 'pt'];

export const LANG_LABELS: Record<Lang, string> = {
	es: 'ES',
	en: 'EN',
	pt: 'PT',
};

/** Rutas de portfolio por idioma (sin prefijo BASE_URL). */
export const pagePaths: Record<Page, Record<Lang, string>> = {
	home: { es: '/', en: '/en/', pt: '/pt/' },
	faq: { es: '/faq', en: '/en/faq', pt: '/pt/faq' },
};

/** Prefijo de docs Starlight por idioma (sin prefijo BASE_URL). */
export const docsPaths: Record<Lang, string> = {
	es: '/docs',
	en: '/en/docs',
	pt: '/pt/docs',
};

export function getStrings(lang: Lang) {
	return strings[lang];
}

export const strings = {
	es: {
		meta: {
			title: 'EchoChat — Mensajería empresarial en tiempo real',
			description:
				'Plataforma de mensajería empresarial en tiempo real, open source (AGPL-3.0).',
			faqTitle: 'FAQ — EchoChat',
			faqDescription: 'Preguntas frecuentes sobre EchoChat.',
		},
		nav: {
			home: 'Inicio',
			features: 'Funciones',
			docs: 'Documentación',
			faq: 'FAQ',
			github: 'GitHub',
			langLabel: 'Idioma',
		},
		footer: {
			license: 'Licencia',
			source: 'Código fuente',
		},
		theme: {
			toggle: 'Cambiar tema',
		},
		hero: {
			eyebrow: 'Open source · AGPL-3.0 · Self-hosted',
			titleLine1: 'Mensajería empresarial',
			titleLine2: 'en tiempo real',
			lead: 'Plataforma de comunicación interna full-stack: mensajes, canales, llamadas, difusiones, encuestas y archivos. Todo en tiempo real, listo para autohospedar.',
			viewDocs: 'Ver documentación',
		},
		mockup: {
			chats: 'Chats',
			search: 'Buscar conversación…',
			directs: 'Directos',
			groups: 'Grupos',
			channels: 'Canales',
			away: 'Ausente',
			today: 'Hoy',
			voiceCall: 'Llamada de voz · 0:03',
			typing: 'Franco está escribiendo…',
			typingTemplate: '{name} está escribiendo…',
			placeholder: 'Escribí un mensaje…',
			preview1: 'Hola, probando EchoChat',
		},
		features: {
			eyebrow: 'Funciones',
			title: 'Todo lo que necesita una intranet de comunicación',
			subtitle: 'Un backend, tres plataformas y un conjunto de funciones pensadas para empresas.',
			items: [
				{
					icon: 'message',
					title: 'Mensajería',
					items: [
						'Directos y grupales',
						'Edición e historial',
						'Reacciones y threads',
						'Búsqueda full-text',
						'Fijados, guardados y borradores',
					],
				},
				{
					icon: 'video',
					title: 'Llamadas',
					items: [
						'Voz y video (1:1 y grupal)',
						'Compartir pantalla',
						'WebRTC peer-to-peer',
						'Historial de llamadas',
					],
				},
				{
					icon: 'hash',
					title: 'Canales',
					items: [
						'Categorías y canales oficiales',
						'Acceso abierto / invitación',
						'Roles por miembro',
						'Archivar, silenciar, fijar',
					],
				},
				{
					icon: 'megaphone',
					title: 'Difusiones',
					items: [
						'Listas de difusión',
						'Envío masivo sin visibilidad cruzada',
						'Programadas',
						'Seguimiento de entrega y lectura',
					],
				},
				{
					icon: 'chart',
					title: 'Encuestas',
					items: [
						'Embebidas en mensajes',
						'Anónimas y multi-opción',
						'Conteo en tiempo real',
						'Cierre y expiración',
					],
				},
				{
					icon: 'shield',
					title: 'Seguridad',
					items: [
						'JWT access + refresh',
						'2FA TOTP con backup',
						'RBAC global y por conversación',
						'Helmet, rate limiting, CORS',
					],
				},
				{
					icon: 'folder',
					title: 'Archivos',
					items: [
						'Almacenamiento en MinIO (S3)',
						'Imágenes, video, audio, docs',
						'URLs prefirmadas con TTL',
					],
				},
				{
					icon: 'bell',
					title: 'Notificaciones',
					items: [
						'In-app en tiempo real',
						'Preferencias por evento',
						'Horarios de silencio',
						'Contador de no leídas',
					],
				},
				{
					icon: 'globe',
					title: 'i18n y temas',
					items: ['Español · Inglés · Portugués', 'Claro / oscuro / sistema', '6 colores de acento'],
				},
			],
		},
		platforms: {
			eyebrow: 'Plataformas',
			title: 'Una base, múltiples plataformas',
			subtitle: 'Las tres comparten el mismo backend y la mayor parte de la lógica de negocio.',
			items: [
				{ icon: 'web', name: 'Web', tech: 'React 19 + Vite', status: 'En desarrollo', ok: true },
				{ icon: 'desktop', name: 'Desktop', tech: 'Electron', status: 'Planificado', ok: false },
				{ icon: 'mobile', name: 'Mobile', tech: 'React Native + Expo', status: 'Planificado', ok: false },
			],
		},
		stack: {
			eyebrow: 'Stack',
			title: 'Tech stack',
			subtitle: 'Stack JavaScript de punta a punta, con herramientas maduras y probadas.',
			groups: [
				{
					group: 'Frontend',
					tags: ['React 19', 'Vite', 'Tailwind CSS 4', 'HeroUI', 'Zustand', 'React Router 7', 'Framer Motion', 'i18next'],
				},
				{
					group: 'Backend',
					tags: ['Node.js', 'Express 4', 'Socket.IO', 'Joi', 'Pino', 'JWT', 'Multer'],
				},
				{ group: 'Datos y almacenamiento', tags: ['PostgreSQL 15+', 'MinIO (S3)'] },
				{ group: 'Infraestructura', tags: ['Docker', 'Docker Compose', 'Nginx'] },
			],
			numbers: [
				{ v: '30+', k: 'tablas PostgreSQL' },
				{ v: '20+', k: 'índices optimizados' },
				{ v: '8', k: 'buckets MinIO' },
				{ v: '3', k: 'idiomas' },
				{ v: '6', k: 'colores de acento' },
			],
		},
		install: {
			eyebrow: 'Instalación',
			title: 'De cero a producción en 3 comandos',
			subtitle: 'Docker Compose levanta PostgreSQL, MinIO, backend y frontend con un solo comando.',
			copy: 'copiar',
			copied: 'copiado ✓',
			ready: '→ listo en http://localhost:80',
		},
		cta: {
			title: '¿Listo para probarlo?',
			subtitle: 'Levantalo con Docker en minutos o explorá el código y contribuí.',
			start: 'Empezar ahora',
			viewFaq: 'Ver FAQ',
		},
		chatScript: [
			{ who: 'them', name: 'Franco Costanzo', text: '¿Probaste el mockup del sitio?', time: '15:04' },
			{ who: 'me', name: 'Vos', text: 'Ahora sí parece la app real 🎯', time: '15:05' },
			{ who: 'them', name: 'Franco Costanzo', text: 'Dock + sidebar + composer flotante ✨', time: '15:06' },
			{ who: 'me', name: 'Vos', text: 'Spatial Canvas en el portfolio 😎', time: '15:07' },
		],
		faq: {
			eyebrow: 'Preguntas frecuentes',
			titleLine1: 'Preguntas',
			titleLine2: 'frecuentes',
			lead: 'Todo lo que solés querer saber antes de empezar con EchoChat.',
			items: [
				{
					q: '¿Qué es EchoChat?',
					a: 'Una plataforma de comunicación interna empresarial full-stack JavaScript: mensajería directa y grupal, canales, videollamadas, difusiones, encuestas y compartición de archivos, todo en tiempo real vía Socket.IO.',
				},
				{
					q: '¿Es realmente open source? ¿Qué licencia tiene?',
					a: 'Sí. EchoChat se distribuye bajo la licencia GNU Affero General Public License v3.0 (AGPL-3.0). Podés usarlo, modificarlo y autohospedarlo libremente. Si ofrecés una versión modificada como servicio accesible por red, estás obligado a publicar el código fuente correspondiente.',
				},
				{
					q: '¿Puedo usarlo en mi empresa de forma comercial?',
					a: 'Sí. La AGPL-3.0 permite uso comercial. La única obligación relevante es que, si distribuís el software o lo ofrecés como servicio en red con modificaciones, debés poner a disposición el código fuente bajo la misma licencia.',
				},
				{
					q: '¿Qué necesito para autohospedarlo?',
					a: 'Docker y Docker Compose. El repositorio incluye un docker-compose.yml con perfiles opcionales para PostgreSQL y MinIO, de modo que podés levantar toda la infraestructura integrada o apuntar a servicios externos existentes.',
				},
				{
					q: '¿Qué base de datos y almacenamiento usa?',
					a: 'PostgreSQL 15+ como base de datos relacional y MinIO (compatible con S3) para el almacenamiento de archivos, avatares y grabaciones. Ambos pueden ser locales (vía Docker) o externos.',
				},
				{
					q: '¿Está listo para producción?',
					a: 'La plataforma web está en desarrollo activo (v1.0.0-alpha). El backend, la mensajería en tiempo real, canales, autenticación con 2FA y el almacenamiento de archivos ya funcionan. Algunas funciones (thumbnails automáticos, antivirus, apps de escritorio y móvil) están planificadas en el roadmap.',
				},
				{
					q: '¿En qué plataformas corre?',
					a: 'Hoy funciona la app web (React 19 + Vite). Las versiones de escritorio (Electron) y móvil (React Native + Expo) están planificadas y reutilizarán el mismo backend y gran parte de la lógica del frontend.',
				},
				{
					q: '¿Soporta varios idiomas?',
					a: 'Sí: español, inglés y portugués, con cambio dinámico. Incluye además temas claro/oscuro/sistema y seis colores de acento configurables.',
				},
				{
					q: '¿Cómo puedo contribuir?',
					a: 'El código está en GitHub. Podés abrir issues, proponer mejoras o enviar pull requests. Revisá el README y la documentación para conocer las convenciones de commits y el flujo de desarrollo.',
				},
			],
			ctaTitle: '¿Otra pregunta?',
			ctaSubtitle: 'Abrí un issue en GitHub o revisá la documentación completa.',
			viewDocs: 'Ver documentación →',
			openIssue: 'Abrir un issue',
		},
	},
	en: {
		meta: {
			title: 'EchoChat — Real-time enterprise messaging',
			description: 'Real-time enterprise messaging platform, open source (AGPL-3.0).',
			faqTitle: 'FAQ — EchoChat',
			faqDescription: 'Frequently asked questions about EchoChat.',
		},
		nav: {
			home: 'Home',
			features: 'Features',
			docs: 'Documentation',
			faq: 'FAQ',
			github: 'GitHub',
			langLabel: 'Language',
		},
		footer: {
			license: 'License',
			source: 'Source code',
		},
		theme: {
			toggle: 'Toggle theme',
		},
		hero: {
			eyebrow: 'Open source · AGPL-3.0 · Self-hosted',
			titleLine1: 'Enterprise messaging',
			titleLine2: 'in real time',
			lead: 'Full-stack internal communication platform: messages, channels, calls, broadcasts, polls, and files. All real-time, ready to self-host.',
			viewDocs: 'View documentation',
		},
		mockup: {
			chats: 'Chats',
			search: 'Search conversation…',
			directs: 'Direct',
			groups: 'Groups',
			channels: 'Channels',
			away: 'Away',
			today: 'Today',
			voiceCall: 'Voice call · 0:03',
			typing: 'Franco is typing…',
			typingTemplate: '{name} is typing…',
			placeholder: 'Write a message…',
			preview1: 'Hi, testing EchoChat',
		},
		features: {
			eyebrow: 'Features',
			title: 'Everything an internal communication platform needs',
			subtitle: 'One backend, three platforms, and a feature set built for organizations.',
			items: [
				{
					icon: 'message',
					title: 'Messaging',
					items: [
						'Direct and group chats',
						'Edit and history',
						'Reactions and threads',
						'Full-text search',
						'Pinned, saved, and drafts',
					],
				},
				{
					icon: 'video',
					title: 'Calls',
					items: [
						'Voice and video (1:1 and group)',
						'Screen sharing',
						'WebRTC peer-to-peer',
						'Call history',
					],
				},
				{
					icon: 'hash',
					title: 'Channels',
					items: [
						'Categories and official channels',
						'Open access / invite-only',
						'Per-member roles',
						'Archive, mute, pin',
					],
				},
				{
					icon: 'megaphone',
					title: 'Broadcasts',
					items: [
						'Broadcast lists',
						'Mass send without cross-visibility',
						'Scheduled delivery',
						'Delivery and read tracking',
					],
				},
				{
					icon: 'chart',
					title: 'Polls',
					items: [
						'Embedded in messages',
						'Anonymous and multi-option',
						'Real-time counts',
						'Close and expiration',
					],
				},
				{
					icon: 'shield',
					title: 'Security',
					items: [
						'JWT access + refresh',
						'2FA TOTP with backup',
						'Global and per-conversation RBAC',
						'Helmet, rate limiting, CORS',
					],
				},
				{
					icon: 'folder',
					title: 'Files',
					items: [
						'MinIO (S3) storage',
						'Images, video, audio, docs',
						'Presigned URLs with TTL',
					],
				},
				{
					icon: 'bell',
					title: 'Notifications',
					items: [
						'Real-time in-app',
						'Per-event preferences',
						'Quiet hours',
						'Unread counter',
					],
				},
				{
					icon: 'globe',
					title: 'i18n and themes',
					items: ['Spanish · English · Portuguese', 'Light / dark / system', '6 accent colors'],
				},
			],
		},
		platforms: {
			eyebrow: 'Platforms',
			title: 'One foundation, multiple platforms',
			subtitle: 'All three share the same backend and most of the business logic.',
			items: [
				{ icon: 'web', name: 'Web', tech: 'React 19 + Vite', status: 'In development', ok: true },
				{ icon: 'desktop', name: 'Desktop', tech: 'Electron', status: 'Planned', ok: false },
				{ icon: 'mobile', name: 'Mobile', tech: 'React Native + Expo', status: 'Planned', ok: false },
			],
		},
		stack: {
			eyebrow: 'Stack',
			title: 'Tech stack',
			subtitle: 'End-to-end JavaScript stack with mature, battle-tested tools.',
			groups: [
				{
					group: 'Frontend',
					tags: ['React 19', 'Vite', 'Tailwind CSS 4', 'HeroUI', 'Zustand', 'React Router 7', 'Framer Motion', 'i18next'],
				},
				{
					group: 'Backend',
					tags: ['Node.js', 'Express 4', 'Socket.IO', 'Joi', 'Pino', 'JWT', 'Multer'],
				},
				{ group: 'Data and storage', tags: ['PostgreSQL 15+', 'MinIO (S3)'] },
				{ group: 'Infrastructure', tags: ['Docker', 'Docker Compose', 'Nginx'] },
			],
			numbers: [
				{ v: '30+', k: 'PostgreSQL tables' },
				{ v: '20+', k: 'optimized indexes' },
				{ v: '8', k: 'MinIO buckets' },
				{ v: '3', k: 'languages' },
				{ v: '6', k: 'accent colors' },
			],
		},
		install: {
			eyebrow: 'Installation',
			title: 'From zero to production in 3 commands',
			subtitle: 'Docker Compose starts PostgreSQL, MinIO, backend, and frontend with a single command.',
			copy: 'copy',
			copied: 'copied ✓',
			ready: '→ ready at http://localhost:80',
		},
		cta: {
			title: 'Ready to try it?',
			subtitle: 'Spin it up with Docker in minutes or explore the code and contribute.',
			start: 'Get started',
			viewFaq: 'View FAQ',
		},
		chatScript: [
			{ who: 'them', name: 'Franco Costanzo', text: 'Did you try the site mockup?', time: '15:04' },
			{ who: 'me', name: 'You', text: 'Now it really looks like the app 🎯', time: '15:05' },
			{ who: 'them', name: 'Franco Costanzo', text: 'Dock + sidebar + floating composer ✨', time: '15:06' },
			{ who: 'me', name: 'You', text: 'Spatial Canvas on the portfolio 😎', time: '15:07' },
		],
		faq: {
			eyebrow: 'Frequently asked questions',
			titleLine1: 'Frequently',
			titleLine2: 'asked questions',
			lead: 'Everything you usually want to know before getting started with EchoChat.',
			items: [
				{
					q: 'What is EchoChat?',
					a: 'A full-stack JavaScript enterprise internal communication platform: direct and group messaging, channels, video calls, broadcasts, polls, and file sharing — all in real time via Socket.IO.',
				},
				{
					q: 'Is it really open source? What license does it use?',
					a: 'Yes. EchoChat is distributed under the GNU Affero General Public License v3.0 (AGPL-3.0). You can use, modify, and self-host it freely. If you offer a modified version as a network-accessible service, you must publish the corresponding source code.',
				},
				{
					q: 'Can I use it commercially in my company?',
					a: 'Yes. AGPL-3.0 allows commercial use. The main obligation is that if you distribute the software or offer it as a network service with modifications, you must make the source code available under the same license.',
				},
				{
					q: 'What do I need to self-host it?',
					a: 'Docker and Docker Compose. The repository includes a docker-compose.yml with optional profiles for PostgreSQL and MinIO, so you can run the full integrated stack or point to existing external services.',
				},
				{
					q: 'What database and storage does it use?',
					a: 'PostgreSQL 15+ as the relational database and MinIO (S3-compatible) for file storage, avatars, and recordings. Both can be local (via Docker) or external.',
				},
				{
					q: 'Is it production-ready?',
					a: 'The web platform is in active development (v1.0.0-alpha). The backend, real-time messaging, channels, 2FA authentication, and file storage already work. Some features (automatic thumbnails, antivirus, desktop and mobile apps) are planned on the roadmap.',
				},
				{
					q: 'Which platforms does it run on?',
					a: 'The web app (React 19 + Vite) works today. Desktop (Electron) and mobile (React Native + Expo) versions are planned and will reuse the same backend and much of the frontend logic.',
				},
				{
					q: 'Does it support multiple languages?',
					a: 'Yes: Spanish, English, and Portuguese with dynamic switching. It also includes light/dark/system themes and six configurable accent colors.',
				},
				{
					q: 'How can I contribute?',
					a: 'The code is on GitHub. You can open issues, propose improvements, or submit pull requests. Check the README and documentation for commit conventions and the development workflow.',
				},
			],
			ctaTitle: 'Another question?',
			ctaSubtitle: 'Open an issue on GitHub or read the full documentation.',
			viewDocs: 'View documentation →',
			openIssue: 'Open an issue',
		},
	},
	pt: {
		meta: {
			title: 'EchoChat — Mensagens empresariais em tempo real',
			description: 'Plataforma de mensagens empresariais em tempo real, open source (AGPL-3.0).',
			faqTitle: 'FAQ — EchoChat',
			faqDescription: 'Perguntas frequentes sobre o EchoChat.',
		},
		nav: {
			home: 'Início',
			features: 'Funcionalidades',
			docs: 'Documentação',
			faq: 'FAQ',
			github: 'GitHub',
			langLabel: 'Idioma',
		},
		footer: {
			license: 'Licença',
			source: 'Código-fonte',
		},
		theme: {
			toggle: 'Alternar tema',
		},
		hero: {
			eyebrow: 'Open source · AGPL-3.0 · Self-hosted',
			titleLine1: 'Mensagens empresariais',
			titleLine2: 'em tempo real',
			lead: 'Plataforma de comunicação interna full-stack: mensagens, canais, chamadas, difusões, enquetes e arquivos. Tudo em tempo real, pronto para auto-hospedar.',
			viewDocs: 'Ver documentação',
		},
		mockup: {
			chats: 'Chats',
			search: 'Buscar conversa…',
			directs: 'Diretos',
			groups: 'Grupos',
			channels: 'Canais',
			away: 'Ausente',
			today: 'Hoje',
			voiceCall: 'Chamada de voz · 0:03',
			typing: 'Franco está digitando…',
			typingTemplate: '{name} está digitando…',
			placeholder: 'Escreva uma mensagem…',
			preview1: 'Olá, testando o EchoChat',
		},
		features: {
			eyebrow: 'Funcionalidades',
			title: 'Tudo o que uma intranet de comunicação precisa',
			subtitle: 'Um backend, três plataformas e um conjunto de funcionalidades pensadas para empresas.',
			items: [
				{
					icon: 'message',
					title: 'Mensagens',
					items: [
						'Diretas e em grupo',
						'Edição e histórico',
						'Reações e threads',
						'Busca full-text',
						'Fixadas, salvas e rascunhos',
					],
				},
				{
					icon: 'video',
					title: 'Chamadas',
					items: [
						'Voz e vídeo (1:1 e em grupo)',
						'Compartilhamento de tela',
						'WebRTC peer-to-peer',
						'Histórico de chamadas',
					],
				},
				{
					icon: 'hash',
					title: 'Canais',
					items: [
						'Categorias e canais oficiais',
						'Acesso aberto / convite',
						'Papéis por membro',
						'Arquivar, silenciar, fixar',
					],
				},
				{
					icon: 'megaphone',
					title: 'Difusões',
					items: [
						'Listas de difusão',
						'Envio em massa sem visibilidade cruzada',
						'Agendadas',
						'Acompanhamento de entrega e leitura',
					],
				},
				{
					icon: 'chart',
					title: 'Enquetes',
					items: [
						'Embutidas em mensagens',
						'Anônimas e multi-opção',
						'Contagem em tempo real',
						'Encerramento e expiração',
					],
				},
				{
					icon: 'shield',
					title: 'Segurança',
					items: [
						'JWT access + refresh',
						'2FA TOTP com backup',
						'RBAC global e por conversa',
						'Helmet, rate limiting, CORS',
					],
				},
				{
					icon: 'folder',
					title: 'Arquivos',
					items: [
						'Armazenamento em MinIO (S3)',
						'Imagens, vídeo, áudio, docs',
						'URLs pré-assinadas com TTL',
					],
				},
				{
					icon: 'bell',
					title: 'Notificações',
					items: [
						'In-app em tempo real',
						'Preferências por evento',
						'Horários de silêncio',
						'Contador de não lidas',
					],
				},
				{
					icon: 'globe',
					title: 'i18n e temas',
					items: ['Espanhol · Inglês · Português', 'Claro / escuro / sistema', '6 cores de destaque'],
				},
			],
		},
		platforms: {
			eyebrow: 'Plataformas',
			title: 'Uma base, múltiplas plataformas',
			subtitle: 'As três compartilham o mesmo backend e a maior parte da lógica de negócio.',
			items: [
				{ icon: 'web', name: 'Web', tech: 'React 19 + Vite', status: 'Em desenvolvimento', ok: true },
				{ icon: 'desktop', name: 'Desktop', tech: 'Electron', status: 'Planejado', ok: false },
				{ icon: 'mobile', name: 'Mobile', tech: 'React Native + Expo', status: 'Planejado', ok: false },
			],
		},
		stack: {
			eyebrow: 'Stack',
			title: 'Tech stack',
			subtitle: 'Stack JavaScript de ponta a ponta, com ferramentas maduras e comprovadas.',
			groups: [
				{
					group: 'Frontend',
					tags: ['React 19', 'Vite', 'Tailwind CSS 4', 'HeroUI', 'Zustand', 'React Router 7', 'Framer Motion', 'i18next'],
				},
				{
					group: 'Backend',
					tags: ['Node.js', 'Express 4', 'Socket.IO', 'Joi', 'Pino', 'JWT', 'Multer'],
				},
				{ group: 'Dados e armazenamento', tags: ['PostgreSQL 15+', 'MinIO (S3)'] },
				{ group: 'Infraestrutura', tags: ['Docker', 'Docker Compose', 'Nginx'] },
			],
			numbers: [
				{ v: '30+', k: 'tabelas PostgreSQL' },
				{ v: '20+', k: 'índices otimizados' },
				{ v: '8', k: 'buckets MinIO' },
				{ v: '3', k: 'idiomas' },
				{ v: '6', k: 'cores de destaque' },
			],
		},
		install: {
			eyebrow: 'Instalação',
			title: 'Do zero à produção em 3 comandos',
			subtitle: 'Docker Compose sobe PostgreSQL, MinIO, backend e frontend com um único comando.',
			copy: 'copiar',
			copied: 'copiado ✓',
			ready: '→ pronto em http://localhost:80',
		},
		cta: {
			title: 'Pronto para testar?',
			subtitle: 'Suba com Docker em minutos ou explore o código e contribua.',
			start: 'Começar agora',
			viewFaq: 'Ver FAQ',
		},
		chatScript: [
			{ who: 'them', name: 'Franco Costanzo', text: 'Testou o mockup do site?', time: '15:04' },
			{ who: 'me', name: 'Você', text: 'Agora parece mesmo o app 🎯', time: '15:05' },
			{ who: 'them', name: 'Franco Costanzo', text: 'Dock + sidebar + composer flutuante ✨', time: '15:06' },
			{ who: 'me', name: 'Você', text: 'Spatial Canvas no portfólio 😎', time: '15:07' },
		],
		faq: {
			eyebrow: 'Perguntas frequentes',
			titleLine1: 'Perguntas',
			titleLine2: 'frequentes',
			lead: 'Tudo o que você costuma querer saber antes de começar com o EchoChat.',
			items: [
				{
					q: 'O que é o EchoChat?',
					a: 'Uma plataforma de comunicação interna empresarial full-stack JavaScript: mensagens diretas e em grupo, canais, videochamadas, difusões, enquetes e compartilhamento de arquivos, tudo em tempo real via Socket.IO.',
				},
				{
					q: 'É realmente open source? Qual licença usa?',
					a: 'Sim. O EchoChat é distribuído sob a licença GNU Affero General Public License v3.0 (AGPL-3.0). Você pode usá-lo, modificá-lo e auto-hospedá-lo livremente. Se oferecer uma versão modificada como serviço acessível pela rede, deve publicar o código-fonte correspondente.',
				},
				{
					q: 'Posso usá-lo comercialmente na minha empresa?',
					a: 'Sim. A AGPL-3.0 permite uso comercial. A principal obrigação é que, se você distribuir o software ou oferecê-lo como serviço em rede com modificações, deve disponibilizar o código-fonte sob a mesma licença.',
				},
				{
					q: 'O que preciso para auto-hospedar?',
					a: 'Docker e Docker Compose. O repositório inclui um docker-compose.yml com perfis opcionais para PostgreSQL e MinIO, permitindo subir toda a infraestrutura integrada ou apontar para serviços externos existentes.',
				},
				{
					q: 'Qual banco de dados e armazenamento usa?',
					a: 'PostgreSQL 15+ como banco relacional e MinIO (compatível com S3) para armazenamento de arquivos, avatares e gravações. Ambos podem ser locais (via Docker) ou externos.',
				},
				{
					q: 'Está pronto para produção?',
					a: 'A plataforma web está em desenvolvimento ativo (v1.0.0-alpha). O backend, mensagens em tempo real, canais, autenticação com 2FA e armazenamento de arquivos já funcionam. Algumas funcionalidades (thumbnails automáticos, antivírus, apps desktop e mobile) estão planejadas no roadmap.',
				},
				{
					q: 'Em quais plataformas roda?',
					a: 'Hoje funciona o app web (React 19 + Vite). As versões desktop (Electron) e mobile (React Native + Expo) estão planejadas e reutilizarão o mesmo backend e grande parte da lógica do frontend.',
				},
				{
					q: 'Suporta vários idiomas?',
					a: 'Sim: espanhol, inglês e português, com troca dinâmica. Inclui também temas claro/escuro/sistema e seis cores de destaque configuráveis.',
				},
				{
					q: 'Como posso contribuir?',
					a: 'O código está no GitHub. Você pode abrir issues, propor melhorias ou enviar pull requests. Consulte o README e a documentação para conhecer as convenções de commits e o fluxo de desenvolvimento.',
				},
			],
			ctaTitle: 'Outra pergunta?',
			ctaSubtitle: 'Abra uma issue no GitHub ou consulte a documentação completa.',
			viewDocs: 'Ver documentação →',
			openIssue: 'Abrir uma issue',
		},
	},
} as const;
