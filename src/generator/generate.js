const fs = require('fs')
const bail = require('bail')
const https = require('https')
const collect = require('collect.js')
const concat = require('concat-stream')
const rawCodepoints = require('codepoints')
const rawEmojis = require('emojibase-data/en/data.json')
const { parse } = require('json2csv')
const { groups, subgroups } = require('emojibase-data/meta/groups.json')
const entityLookupData = require('./src/entity-lookup')

function getHex(char) {
  return Array.from(char)
    .map(v => v.codePointAt(0).toString(16))
    .map(hex => '0000'.substring(0, 4 - hex.length) + hex)
    .map(str => str.toUpperCase())
    .join(' ')
}

function formatCodePoints(data, HTMLentities) {
  const chars = collect(data)
    .filter()
    .filter(item => !item.name.startsWith('<') && !item.name.endsWith('>'))
    .filter(item => ![
      'Variation Selectors',
      'Variation Selectors Supplement',
      'Tags',
    ].includes(item.block))
    .map(item => {
      const symbol = String.fromCodePoint(item.code)
      const entity = HTMLentities.find(entityItem => entityItem.symbol === symbol)
      const entities = entity ? collect(entity.entities).unique().toArray().join(' ') : ''
      const tags = entity ? entity.tags.join(' ') : ''

      return {
        symbol,
        hex: getHex(symbol),
        code: item.code,
        name: item.name.toLowerCase(),
        category: item.block,
        entities,
        tags,
      }
    })
    .toArray()

  const emojis = collect(rawEmojis)
    .map(item => {

      const tags = [
        'emoji',
        subgroups[item.subgroup],
        ...item.tags,
      ].join(' ')

      return [
        {
          symbol: item.emoji,
          hex: item.hexcode.split('-').join(' '),
          code: '',
          name: item.annotation,
          category: groups[item.group],
          entities: '',
          tags,
        },
        ...(item.skins
          ? item.skins.map(skin => ({
            symbol: skin.emoji,
            hex: skin.hexcode.split('-').join(' '),
            code: '',
            name: skin.annotation,
            category: groups[skin.group],
            entities: '',
            tags,
          })) : []
        ),
      ]
    })
    .flatten(1)
    .toArray()

  const charsWithoutEmojis = collect(chars)
    .filter(item => !emojis.find(emoji => emoji.hex === item.hex))
    .toArray()

  return [
    ...charsWithoutEmojis,
    ...emojis,
  ]
}

function formatEntities(data) {
  const rawEntities = []

  Object.keys(data).forEach(key => {
    if (key[key.length - 1] === ';') {
      rawEntities.push({
        entity: key.slice(1, -1),
        symbol: data[key].characters,
      })
    }
  })

  const formattedEntities = collect(rawEntities)
    .groupBy('symbol')
    .map(items => {
      const { symbol } = items.first()
      const entities = items.map(item => item.entity).toArray()
      const entityLookupItem = collect(entityLookupData)
        .filter(item => entities.includes(item.name))
        .first()
      const tags = entityLookupItem ? entityLookupItem.tags : []

      return [{
        symbol,
        entities,
        tags,
      }]
    })
    .flatten(1)
    .toArray()

  return formattedEntities
}

function healthcheck(data) {
  const duplicates = collect(data)
    .groupBy('symbol')
    .filter(items => items.toArray().length > 1)
    .map(items => items.toArray()[0].symbol)
    .toArray()

  console.log({ duplicates })
}

function onconcat(response) {
  const entities = formatEntities(JSON.parse(response))
  const codepoints = formatCodePoints(rawCodepoints, entities)
  const csv = parse(codepoints)

  healthcheck(codepoints)

  fs.writeFile('./src/generator/dist/codepoints.json', JSON.stringify(rawCodepoints, null, 2), bail)
  fs.writeFile('./src/generator/dist/data.json', JSON.stringify(codepoints, null, 2), bail)
  fs.writeFile('./src/generator/dist/data.csv', csv, bail)
}

https.get('https://html.spec.whatwg.org/entities.json', res => {
  res.pipe(concat(onconcat)).on('error', bail)
})
