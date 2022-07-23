export function filterInt(value: string) {
	if(/[0-9]$/.test(value))
		return Number(value)
	return NaN
}