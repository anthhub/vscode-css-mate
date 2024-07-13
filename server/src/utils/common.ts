
export function kebabToCamel(str: string): string {
    if (!str.includes('-')) return str;

    return str.split('-').map((item, index) => {
        if (index === 0) return item
        const slice = item.split('')
        slice[0] = slice[0].toUpperCase()
        return slice.join('')
    }).join('')
}

export function batchKebabToCamel(strs: string[]): string[] {
    return strs.map((str) => kebabToCamel(str))
}

export function batchKebabAndCamel(strs: string[]): string[] {
    return strs?.reduce<string[]>((res, cur) => {
        const str = kebabToCamel(cur)
        if (str !== cur) {
            res.push(str)
        }
        res.push(cur)
        return res
    }, [])
}

export function similar(s: string, t: string, f: number = 3): number {
    if (!s || !t) {
        return 0
    }
    var l = s.length > t.length ? s.length : t.length
    var n = s.length
    var m = t.length
    var d: number[][] = []
    f = f || 3
    var min = function (a: number, b: number, c: number) {
        return a < b ? (a < c ? a : c) : (b < c ? b : c)
    }
    var i, j, si, tj, cost
    if (n === 0) return m
    if (m === 0) return n
    for (i = 0; i <= n; i++) {
        d[i] = []
        d[i][0] = i
    }
    for (j = 0; j <= m; j++) {
        d[0][j] = j
    }
    for (i = 1; i <= n; i++) {
        si = s.charAt(i - 1)
        for (j = 1; j <= m; j++) {
            tj = t.charAt(j - 1)
            if (si === tj) {
                cost = 0
            } else {
                cost = 1
            }
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
        }
    }
    let res = (1 - d[n][m] / l)
    return Number(res.toFixed(f))
}


export function stringSimilarity(source: string, strs: string[]) {
    const ratings = strs.map(str => {
        return { target: str, rating: similar(source, str) || similar(source.toLowerCase(), str) / 2 || similar(source.toUpperCase(), str) / 4 }
    }).sort((a, b) => b.rating - a.rating)

    return { ratings, best: ratings?.[0] }
}


export function createLintMsg(body: string, property: string, recommend: string) {
    return `"${property}" doesn't exist on "${body}", are you referring to "${recommend}"?`
}

export function createLintBodyMsg(body: string) {
    return `"${body}" must list a property`
}

export function isLintBodyMsg(msg: string) {
    return msg.includes(`must list a property`)
}


export function createCodeActionMsg(body: string, property: string, recommend: string) {
    return `"${recommend}" replace to "${property}"?`
}

export function getLintMsg(message: string) {
    const match = message.match(new RegExp(`^"(.*?)" doesn't exist on "(.*?)", are you referring to "(.*?)"\\?$`))
    const [property, body, recommend]: string[] = [match?.[1], match?.[2], match?.[2]].map((item = '') => item.trim())
    return { property, body, recommend }
}

export function getLintBodyMsg(message: string) {
    const match = message.match(new RegExp(`^"(.*?)" must list a property`))
    const body = match?.[1].trim() || ''
    return { body }
}
