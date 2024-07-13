


function findIdent(target: string, node: any): any {
    if (node.type === "Identifier") {
        if (node.name === target) {
            return node
        }
    }

    if (node.type === "MemberExpression") {
        const ret = findIdent(target, node.object)
        if (ret) {
            return node
        }
    }

    if (node.type === "ObjectExpression") {
        return node.properties.map((property: any) => findIdent(target, property)).filter(Boolean)
    }

    if (node.type === "ObjectProperty") {
        return findIdent(target, node.key)
    }

    if (node.type === "JSXExpressionContainer") {
        return findIdent(target, node.expression)
    }

    if (node.type === "CallExpression") {
        return node.arguments.map((argument: any) => findIdent(target, argument)).filter(Boolean)
    }

    if (node.type === "ArrayExpression") {
        return node.elements.map((element: any) => findIdent(target, element)).filter(Boolean)
    }

    if (node.type === "TemplateLiteral") {
        return node.expressions.map((expression: any) => findIdent(target, expression)).filter(Boolean)
    }
}


export function traverseJSX(target: string, node: any) {
    return findIdent(target, node)
}