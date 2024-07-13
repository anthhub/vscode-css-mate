
const parents = ['ruleset', 'block', 'stylesheet', 'atrule', 'class', 'selector']


export function traverseStylesheet(node: any) {
    const pselectors: any[] = []
    const selectors: any[] = []
    node?.children?.forEach((item: any) => {
        if (item.type === 'ruleset') {
            traverseRuleset(item, selectors, 0, pselectors)
            return
        }
        if (item.type === 'block') {
            traverseBlock(item, selectors, null, 0, pselectors)
            return
        }
        if (item.type === 'atrule') {
            traverseAtrule(item, selectors, null, 0, pselectors)
            return
        }
        if (item.type === 'selector') {
            traverseSelector(item, selectors, null, 0, pselectors)
            return
        }
        if (item.type === 'class') {
            traverseClass(item, selectors, null, 0, pselectors)
            return
        }
    })

    console.log('selectors', selectors)

    return selectors
}
function traverseRuleset(node: any, selectors: any[], level: number, pselectors: any[]) {
    level += 1
    const pruleset = node
    node?.children?.forEach((item: any) => {
        if (item.type === 'ruleset') {
            traverseRuleset(item, selectors, level, pselectors)
            return
        }
        if (item.type === 'block') {
            traverseBlock(item, selectors, pruleset, level, pselectors)
            return
        }
        if (item.type === 'atrule') {
            traverseAtrule(item, selectors, pruleset, level, pselectors)
            return
        }
        if (item.type === 'selector') {
            traverseSelector(item, selectors, pruleset, level, pselectors)
            return
        }
        if (item.type === 'class') {
            traverseClass(item, selectors, pruleset, level, pselectors)
            return
        }
        if (node.type === 'parentSelectorExtension') {
            traverseParentSelectorExtension(node, selectors, pruleset, level, pselectors)
            return
        }
    })

}
function traverseBlock(node: any, selectors: any[], pruleset: any, level: number, pselectors: any[]) {
    node?.children?.forEach((item: any) => {
        if (item.type === 'ruleset') {
            traverseRuleset(item, selectors, level, pselectors)
            return
        }
        if (item.type === 'block') {
            traverseBlock(item, selectors, pruleset, level, pselectors)
            return
        }
        if (item.type === 'atrule') {
            traverseAtrule(item, selectors, pruleset, level, pselectors)
            return
        }
        if (item.type === 'selector') {
            traverseSelector(item, selectors, pruleset, level, pselectors)
            return
        }
        if (item.type === 'class') {
            traverseClass(item, selectors, pruleset, level, pselectors)
            return
        }
        if (node.type === 'parentSelectorExtension') {
            traverseParentSelectorExtension(node, selectors, pruleset, level, pselectors)
            return
        }
    })
}
function traverseAtrule(node: any, selectors: any[], pruleset: any, level: number, pselectors: any[]) {

    node?.children?.forEach((item: any) => {
        if (item.type === 'ruleset') {
            traverseRuleset(item, selectors, level, pselectors)
            return
        }
        if (item.type === 'block') {
            traverseBlock(item, selectors, pruleset, level, pselectors)
            return
        }
        if (item.type === 'atrule') {
            traverseAtrule(item, selectors, pruleset, level, pselectors)
            return
        }
        if (item.type === 'selector') {
            traverseSelector(item, selectors, pruleset, level, pselectors)
            return
        }
        if (item.type === 'class') {
            traverseClass(item, selectors, pruleset, level, pselectors)
            return
        }
        if (node.type === 'parentSelectorExtension') {
            traverseParentSelectorExtension(node, selectors, pruleset, level, pselectors)
            return
        }
    })
}



function traverseSelector(node: any, selectors: any[], pruleset: any, level: number, pselectors: any[]) {
    node?.children?.forEach((item: any) => {
        if (item.type === 'ruleset') {
            traverseRuleset(item, selectors, level, pselectors)
            return
        }
        if (item.type === 'block') {
            traverseBlock(item, selectors, pruleset, level, pselectors)
            return
        }
        if (item.type === 'atrule') {
            traverseAtrule(item, selectors, pruleset, level, pselectors)
            return
        }

        if (item.type === 'selector') {
            traverseSelector(item, selectors, pruleset, level, pselectors)
            return
        }

        if (item.type === 'class') {
            traverseClass(item, selectors, pruleset, level, pselectors)
            return
        }
        if (item.type === 'parentSelectorExtension') {
            traverseParentSelectorExtension(item, selectors, pruleset, level, pselectors)
            return
        }
    })
}

function traverseParentSelectorExtension(node: any, selectors: any[], pruleset: any, level: number, pselectors: any[]) {
    node?.children?.forEach((item: any) => {
        const psel = pselectors[level - 1]
        if (psel && item.type === 'ident') {
            item.value = psel.value + item.value
            item.pruleset = pruleset
            selectors.push(item)
        }
    })
}

function traverseClass(node: any, selectors: any[], pruleset: any, level: number, pselectors: any[]) {
    node?.children?.forEach((item: any) => {
        if (item.type === "typeSelector") {
            return
        }
        // 伪元素
        if (item.type === 'pseudoElement') {
            return
        }
        if (item.type === 'ident') {
            item.pruleset = pruleset
            selectors.push(item)
            pselectors[level] = item
        }
        if (node.type === 'parentSelectorExtension') {
            traverseParentSelectorExtension(node, selectors, pruleset, level, pselectors)
            return
        }
    })
}








