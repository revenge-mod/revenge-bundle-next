import { describe, expect, test } from 'vitest'
import { getPluginContributorName, parsePluginContributor } from './utils'

const Id1 = '123456789012345678'
const Id2 = '876543210987654321'

describe('parsePluginContributor', () => {
    test('parses a name only', () => {
        expect(parsePluginContributor('  Revenge  ')).toEqual({
            name: 'Revenge',
            ids: [],
            links: [],
        })
    })

    test('parses IDs and links', () => {
        expect(
            parsePluginContributor(
                `Jane Doe <${Id1}> <${Id2}> (https://example.com/jane) (mailto:jane@example.com)`,
            ),
        ).toEqual({
            name: 'Jane Doe',
            ids: [Id1, Id2],
            links: ['https://example.com/jane', 'mailto:jane@example.com'],
        })
    })

    test('allows entries without whitespace between them', () => {
        expect(
            parsePluginContributor(`Jane<${Id1}>(http://example.com)`),
        ).toEqual({
            name: 'Jane',
            ids: [Id1],
            links: ['http://example.com'],
        })
    })

    test.each([
        ['an empty name', `<${Id1}>`],
        ['an ID after a link', `Jane (https://example.com) <${Id1}>`],
        ['a short ID', 'Jane <1234>'],
        ['a non-numeric ID', 'Jane <jane@example.com>'],
        ['an unsupported scheme', 'Jane (javascript:alert(1))'],
        ['a link without a scheme', 'Jane (example.com)'],
        ['a parenthesized name', 'Jane (Doe)'],
        ['trailing text', `Jane <${Id1}> extra`],
        ['an unclosed entry', `Jane <${Id1}`],
    ])('rejects %s', (_, input) => {
        expect(parsePluginContributor(input)).toBeNull()
    })
})

describe('getPluginContributorName', () => {
    test('returns the parsed name', () => {
        expect(getPluginContributorName(`Jane <${Id1}>`)).toBe('Jane')
    })

    test('returns the raw string when unparseable', () => {
        expect(getPluginContributorName('Jane (Doe)')).toBe('Jane (Doe)')
    })
})
