// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// URL pública del sitio. Sobrescribible por entorno para desplegar en otro
// host sin tocar código (p.ej. GitHub Pages setea ASTRO_SITE en el workflow).
const SITE_URL = process.env.ASTRO_SITE || 'https://echochat.netlify.app';
// Subruta del deploy (p.ej. '/EchoChat' en GitHub Pages). Sin definir = raíz.
const BASE_PATH = process.env.ASTRO_BASE;
// Repositorio en GitHub (ajustar si el nombre del repo es distinto)
const REPO_URL = 'https://github.com/FrancoCostanzo/EchoChat';

// https://astro.build/config
export default defineConfig({
	site: SITE_URL,
	base: BASE_PATH,
	integrations: [
		starlight({
			title: 'EchoChat',
			description:
				'Plataforma de mensajería empresarial en tiempo real, open source (AGPL-3.0).',
			defaultLocale: 'root',
			locales: {
				root: { label: 'Español', lang: 'es' },
				en: { label: 'English', lang: 'en' },
				pt: { label: 'Português', lang: 'pt' },
			},
			customCss: ['./src/styles/starlight.css'],
			// Tipografías del design system (Clash Display + Satoshi + JetBrains Mono)
			head: [
				{
					tag: 'link',
					attrs: { rel: 'preconnect', href: 'https://api.fontshare.com', crossorigin: true },
				},
				{
					tag: 'link',
					attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true },
				},
				{
					tag: 'link',
					attrs: {
						rel: 'stylesheet',
						href: 'https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,600,700&display=swap',
					},
				},
				{
					tag: 'link',
					attrs: {
						rel: 'stylesheet',
						href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap',
					},
				},
			],
			social: [{ icon: 'github', label: 'GitHub', href: REPO_URL }],
			// Las páginas de portfolio (/) y FAQ (/faq) son páginas Astro propias;
			// Starlight sólo gestiona la sección de documentación bajo /docs.
			sidebar: [
				{ label: '← Volver al inicio', link: '/' },
				{ label: 'FAQ', link: '/faq' },
				{
					label: 'Empezar',
					items: [
						{ label: 'Introducción', slug: 'docs' },
						{ label: 'Características', slug: 'docs/caracteristicas' },
						{ label: 'Conceptos', slug: 'docs/conceptos' },
						{ label: 'Estado del proyecto', slug: 'docs/estado' },
					],
				},
				{
					label: 'Instalación y despliegue',
					collapsed: true,
					items: [
						{ label: 'Requisitos', slug: 'docs/despliegue/requisitos' },
						{ label: 'Instalación (desarrollo)', slug: 'docs/instalacion' },
						{ label: 'Despliegue con Docker', slug: 'docs/despliegue' },
						{ label: 'Variables de entorno', slug: 'docs/despliegue/variables-entorno' },
						{ label: 'Base de datos', slug: 'docs/despliegue/base-de-datos' },
						{ label: 'Almacenamiento', slug: 'docs/despliegue/almacenamiento' },
						{ label: 'Red y TURN', slug: 'docs/despliegue/red-y-turn' },
						{ label: 'Backups', slug: 'docs/despliegue/backups' },
						{ label: 'Actualización', slug: 'docs/despliegue/actualizacion' },
						{ label: 'Troubleshooting', slug: 'docs/despliegue/troubleshooting' },
					],
				},
				{
					label: 'Guía de uso',
					collapsed: true,
					items: [
						{ label: 'Primeros pasos', slug: 'docs/uso/primeros-pasos' },
						{ label: 'Mensajería', slug: 'docs/uso/mensajeria' },
						{ label: 'Formato enriquecido', slug: 'docs/uso/formato' },
						{ label: 'Emojis, stickers y GIFs', slug: 'docs/uso/stickers-y-gifs' },
						{ label: 'Encuestas', slug: 'docs/uso/encuestas' },
						{ label: 'Llamadas de voz y video', slug: 'docs/llamadas' },
						{ label: 'Canales', slug: 'docs/uso/canales' },
						{ label: 'Difusiones', slug: 'docs/uso/difusiones' },
						{ label: 'Notificaciones', slug: 'docs/uso/notificaciones' },
						{ label: 'Contactos', slug: 'docs/uso/contactos' },
						{ label: 'Personalización', slug: 'docs/uso/personalizacion' },
					],
				},
				{
					label: 'Administración',
					collapsed: true,
					items: [
						{ label: 'Panel de administración', slug: 'docs/admin/panel' },
						{ label: 'Usuarios', slug: 'docs/admin/usuarios' },
						{ label: 'RBAC', slug: 'docs/admin/rbac' },
						{ label: 'Configuración del sistema', slug: 'docs/admin/sistema' },
						{ label: 'Auditoría', slug: 'docs/admin/auditoria' },
						{ label: 'Almacenamiento', slug: 'docs/admin/almacenamiento' },
						{ label: 'Monitoreo', slug: 'docs/admin/monitoreo' },
					],
				},
				{
					label: 'Arquitectura y desarrollo',
					collapsed: true,
					items: [
						{ label: 'Arquitectura', slug: 'docs/arquitectura' },
						{ label: 'Modelo de datos', slug: 'docs/desarrollo/modelo-datos' },
						{ label: 'Backend', slug: 'docs/desarrollo/backend' },
						{ label: 'Frontend', slug: 'docs/desarrollo/frontend' },
						{ label: 'Tiempo real', slug: 'docs/desarrollo/tiempo-real' },
						{ label: 'API REST', slug: 'docs/desarrollo/api' },
						{ label: 'Spatial Canvas', slug: 'docs/desarrollo/spatial-canvas' },
						{ label: 'Internacionalización', slug: 'docs/desarrollo/i18n' },
						{ label: 'Contribuir', slug: 'docs/desarrollo/contribuir' },
					],
				},
			],
		}),
	],
});
