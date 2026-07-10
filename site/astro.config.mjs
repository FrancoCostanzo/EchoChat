// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// URL pública del sitio (cambiar por el dominio real de Netlify / propio)
const SITE_URL = 'https://echochat.netlify.app';
// Repositorio en GitHub (ajustar si el nombre del repo es distinto)
const REPO_URL = 'https://github.com/FrancoCostanzo/EchoChat';

// https://astro.build/config
export default defineConfig({
	site: SITE_URL,
	integrations: [
		starlight({
			title: 'EchoChat',
			description:
				'Plataforma de mensajería empresarial en tiempo real, open source (AGPL-3.0).',
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
					label: 'Documentación',
					items: [
						{ label: 'Introducción', slug: 'docs' },
						{ label: 'Instalación (desarrollo)', slug: 'docs/instalacion' },
						{ label: 'Despliegue con Docker', slug: 'docs/despliegue' },
						{ label: 'Arquitectura', slug: 'docs/arquitectura' },
					],
				},
			],
		}),
	],
});
