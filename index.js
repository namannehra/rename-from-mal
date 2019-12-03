#!/usr/bin/env node

'use strict'

const fs = require('fs')
const path = require('path')

const entities = require('entities')
const fetch = require('node-fetch')

// Unhandled promise rejections are deprecated
// https://nodejs.org/api/deprecations.html#deprecations_dep0018_unhandled_promise_rejections
process.on('unhandledRejection', error => {
    throw error
})

const getFileNames = async () => {
    const dirents = await fs.promises.readdir('./', { withFileTypes: true })
    const notDotDirents = dirents.filter(dirent => dirent.name[0] !== '.')
    const notFiles = notDotDirents.filter(dirent => !dirent.isFile())
    if (notFiles.length) {
        throw new Error(`Non file entries in folder:\n${notFiles.join('\n')}`)
    }
    const names = notDotDirents.map(dirent => dirent.name)
    return names
}

const fetchEpisodePage = async showId => {
    const response = await fetch(`https://myanimelist.net/anime/${showId}/episode`)
    return await response.text()
}

const getEpisodeNamesFromSource = source => (
    Array.from(source.matchAll(/class="fl-l fw-b .*>(.*)</g)).map(result => entities.decodeHTML(result[1]))
)

const getEpisodeNames = async showId => {
    const source = await fetchEpisodePage(showId)
    return getEpisodeNamesFromSource(source)
}

(async () => {

    const showId = process.argv[2]
    const folderName = path.basename(process.cwd())

    if (!showId) {
        throw new Error(`No show ID provided`)
    }

    const [fileNames, episodeNames] = await Promise.all([getFileNames(), getEpisodeNames(showId)])

    if (fileNames.length !== episodeNames.length) {
        throw new Error(`Files and episodes don't match. Files: ${fileNames.length}. Episode: ${episodeNames.length}.`)
    }

    const maxEpisodeNumberLength = fileNames.length.toString().length

    for (let i = 0; i < fileNames.length; i++) {
        const fileName = fileNames[i]
        const episodeName = episodeNames[i]
        const extension = path.extname(fileName)
        const newFileName = (
            `${folderName} - ${(i + 1).toString().padStart(maxEpisodeNumberLength, 0)} - ${episodeName}${extension}`
        )
        fs.promises.rename(fileName, newFileName).then(() => {
            console.log(`${fileName} \u2192 ${newFileName}`)
        })
    }

})()
