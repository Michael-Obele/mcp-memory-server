import type { MemoryType } from '@sepia/shared';

/** Format an ISO timestamp for display. */
export function formatDate(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	return d.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
}

/** Relative time like "3h ago" / "2d ago". */
export function timeAgo(iso: string | null | undefined): string {
	if (!iso) return '—';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '—';
	const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months}mo ago`;
	return `${Math.floor(months / 12)}y ago`;
}

/** Importance as a 0-100 percentage for display. */
export function importancePct(importance: number | null | undefined): number {
	return Math.round((importance ?? 0.5) * 100);
}

/** Tailwind badge classes per memory type. */
export const TYPE_BADGE: Record<MemoryType, string> = {
	fact: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
	observation: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
	preference: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
	instruction: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
};

/** Tailwind badge classes per entity type (fallback for unknown types). */
export function entityTypeBadge(type: string): string {
	const map: Record<string, string> = {
		person: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
		project: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
		tool: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
		concept: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
		repo: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
	};
	return map[type] ?? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

/** Truncate long text with an ellipsis. */
export function truncate(text: string, max = 160): string {
	const t = text.trim().replace(/\s+/g, ' ');
	return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
