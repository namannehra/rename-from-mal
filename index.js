#!/usr/bin/env node

'use strict'

const fs = require('fs')
const path = require('path')

const chalk = require('chalk')
const entities = require('entities')
const fetch = require('node-fetch')

// Unhandled promise rejections are deprecated
// https://nodejs.org/api/deprecations.html#deprecations_dep0018_unhandled_promise_rejections
process.on('unhandledRejection', error => {
    throw error
})

const greenTick = chalk.green.bold('\u2713')
const redCross = chalk.red.bold('\u2717')
const rightArrow = '\u2192'

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

const getMaxLength = strings => {
    let max = 0
    for (const string of strings) {
        if (string.length > max) {
            max = string.length
        }
    }
    return max
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

    const maxFileNameLength = getMaxLength(fileNames)
    const maxEpisodeNumberLength = fileNames.length.toString().length
    const newFileNames = fileNames.map((fileName, index) => {
        const episodeNumber = (index + 1).toString().padStart(maxEpisodeNumberLength, 0)
        const episodeName = episodeNames[index]
        const extension = path.extname(fileName)
        return `${folderName} - ${episodeNumber} - ${episodeName}${extension}`
    })
    const maxNewFileNameLength = getMaxLength(newFileNames)

    const renamePromises = fileNames.map(async (fileName, index) => {
        const newFileName = newFileNames[index]
        let error = null
        try {
            await fs.promises.rename(fileName, newFileName)
        } catch (renameError) {
            error = renameError
        } finally {
            const paddedFileName = fileName.padEnd(maxFileNameLength)
            const paddedNewFileName = newFileName.padEnd(maxNewFileNameLength)
            const status = error ? redCross : greenTick
            return `${paddedFileName} ${rightArrow} ${paddedNewFileName} ${status}`
        }
    })

    for await (const result of renamePromises) {
        console.log(result)
    }

})()
