// '//#' is a start point for a simple text-replacement-type macro. See excmds_macros.py

// {{{ setup

import * as Messaging from "./messaging"

//#content_omit_line
import * as CommandLineContent from "./commandline_content"
//#content_omit_line
import "./number.clamp"
//#content_helper
import * as SELF from "./excmds_content"
//#content_helper
Messaging.addListener('excmd_content', Messaging.attributeCaller(SELF))
/** Message excmds_content.ts in the active tab of the currentWindow */
//#background_helper
import {messageActiveTab} from './messaging'

//#background_helper
import "./number.mod"
//#background_helper
import state from "./state"
//#background_helper
import * as keydown from "./keydown_background"

/** @hidden */
//#background_helper
export const cmd_params = new Map<string, Map<string, string>>()

/** @hidden */
const SEARCH_URL = "https://www.google.co.uk/search?q="

/** @hidden */
function hasScheme(uri: string) {
    return uri.match(/^(\w+):/)
}

/** If maybeURI doesn't have a schema, affix http:// */
/** @hidden */
function forceURI(maybeURI: string) {
    if (hasScheme(maybeURI)) {
        return maybeURI
    } else if (maybeURI.includes(".")) {
        // If you want to access something on the local network, just use .lan
        return "http://" + maybeURI
    } else {
        let urlarr = maybeURI.split("%20")
        // TODO: make this more generic
        if (urlarr[0] == "google"){
            return SEARCH_URL + urlarr.slice(1,urlarr.length).join("%20")
        } else {
            return SEARCH_URL + maybeURI
        }
    }
}

/** The first active tab in the currentWindow.
 *
 * TODO: Highlander theory: Can there ever be more than one?
 *
 */
/** @hidden */
//#background_helper
async function activeTab() {
    return (await browser.tabs.query({active: true, currentWindow: true}))[0]
}

/** @hidden */
//#background_helper
async function activeTabID() {
    return (await activeTab()).id
}

/** @hidden */
//#background_helper
function tabSetActive(id: number) {
    browser.tabs.update(id, {active: true})
}

// }}}

// {{{ PAGE CONTEXT

//#content
export function scrollpx(a: number, b: number) {
    window.scrollBy(a, b)
}

/** If one argument is given, scroll to that percentage down the page.
    If two arguments are given, treat as x and y values to give to window.scrollTo
*/
//#content
export function scrollto(a: number, b?: number) {
    a = Number(a)
    // if b is undefined, Number(b) is NaN.
    b = Number(b)
    window.scrollTo(
        b ? a : window.scrollX,
        b
            ? b
            : a.clamp(0, 100) *
              (window.document.scrollingElement.scrollHeight / 100)
    )
}

//#content
export function scrollline(n = 1) {
    window.scrollByLines(n)
}
//#content
export function scrollpage(n = 1) {
    window.scrollBy(0, n)
}

/** @hidden */
//#content_helper
function history(n: number) {
    window.history.go(n)
}

//#content
export function forward(n = 1) {
    history(n)
}

//#content
export function back(n = 1) {
    history(n * -1)
}

/** Reload the next n tabs, starting with activeTab, possibly bypassingCache */
//#background
export async function reload(n = 1, hard = false) {
    let tabstoreload = await getnexttabs(await activeTabID(), n)
    let reloadProperties = {bypassCache: hard}
    tabstoreload.map(n => browser.tabs.reload(n, reloadProperties))
}

/** Reload the next n tabs, starting with activeTab. bypass cache for all */
//#background
export async function reloadhard(n = 1) {
    reload(n, true)
}

//#content
export function open(...urlarr: string[]) {
    let url = urlarr.join("%20")
    window.location.href = forceURI(url)
}

//#background
export function help(...urlarr: string[]) {
    let url = urlarr.join("%20")
    // window.location.href = "docs/modules/_excmds_.html#" + url
    browser.tabs.create({url: "static/docs/modules/_excmds_.html#" + url})

}

/** @hidden */
//#content_helper
function getlinks(){
    return document.getElementsByTagName('a')
}

/** Find a likely next/previous link and follow it */
//#content
export function clicknext(dir = "next"){
    let linkarray = Array.from(getlinks())
    let regarray = [/\bnext|^>$|^(>>|»)$|^(>|»)|(>|»)$|\bmore\b/i, /\bprev\b|\bprevious\b|^<$|^(<<|«)$|^(<|«)|(<|«)$/i]

    regarray = window.location.href.match(/rockpapershotgun/) ? [/newer/i,/older/i] : regarray
    let nextreg = (dir == "next") ? regarray[0] : regarray[1]

    // Might need to add more cases to this as we look at more sites
    let nextlinks = linkarray.filter((link) => (link.innerText.match(nextreg) || link.rel.match(nextreg)))

    // Use the last link that matches because next/prev buttons tend to be at the end of the page
    // whereas lots of blogs have "VIEW MORE" etc. plastered all over their pages.
    // Stops us from having to hardcode in RPS and reddit, for example.
    window.location.href = nextlinks.slice(-1)[0].href
}
// }}}

// {{{ TABS

/** Switch to the next tab by index (position on tab bar), wrapping round.

    optional increment is number of tabs forwards to move.
 */
//#background
export async function tabnext(increment = 1) {
    // Get an array of tabs in the current window
    let current_window = await browser.windows.getCurrent()
    let tabs = await browser.tabs.query({windowId: current_window.id})

    // Derive the index we want
    let desiredIndex = ((await activeTab()).index + increment).mod(tabs.length)

    // Find and switch to the tab with that index
    let desiredTab = tabs.find((tab: any) => {
        return tab.index === desiredIndex
    })
    tabSetActive(desiredTab.id)
}

//#background
export function tabprev(increment = 1) {
    tabnext(increment * -1)
}

// TODO: address should default to some page to which we have access
//          and focus the location bar
//#background
export async function tabopen(...addressarr: string[]) {
    let uri
    let address = addressarr.join('%20')
    if (address != "") uri = forceURI(address)
    browser.tabs.create({url: uri})
}

//#background
export async function tabduplicate(id?: number){
    id = id ? id : (await activeTabID())
    browser.tabs.duplicate(id)
}

//#background
export async function tabdetach(id?: number){
    id = id ? id : (await activeTabID())
    browser.windows.create({tabId: id})
}

//#background
export async function tabclose(ids?: number[] | number) {
    if (ids !== undefined) {
        browser.tabs.remove(ids)
    } else {
        // Close the current tab
        browser.tabs.remove(await activeTabID())
    }
}

/** restore most recently closed tab in this window unless the most recently closed item was a window */
//#background
export async function undo(){
    const current_win_id : number = (await browser.windows.getCurrent()).id
    const sessions = await browser.sessions.getRecentlyClosed()

    // The first session object that's a window or a tab from this window. Or undefined if sessions is empty.
    let closed = sessions.find((s) => {
        return ('window' in s || s.tab && (s.tab.windowId == current_win_id))
    })
    if (closed) {
        if (closed.tab) {
            browser.sessions.restore(closed.tab.sessionId)
        }
        else if (closed.window) {
            browser.sessions.restore(closed.window.sessionId)
        }
    }
}

//#background
export async function tabmove(n?: string) {
    let aTab = await activeTab(),
        m: number
    if (!n) {
        browser.tabs.move(aTab.id, {index: -1})
        return
    } else if (n.startsWith("+") || n.startsWith("-")) {
        m = Math.max(0, Number(n) + aTab.index)
    } else m = Number(n)
    browser.tabs.move(aTab.id, {index: m})
}

//#background
export async function pin() {
    let aTab = await activeTab()
    browser.tabs.update(aTab.id, {pinned: !aTab.pinned})
}

// }}}

// {{{ WINDOWS

//#background
export async function winopen(...args: string[]) {
    let address: string
    const createData = {}
    if (args[0] === "-private") {
        createData["incognito"] = true
        address = args.slice(1,args.length).join('%20')
    } else address = args.join('%20')
    createData["url"] = forceURI(address)
    browser.windows.create(createData)
}

//#background
export async function winclose() {
    browser.windows.remove((await browser.windows.getCurrent()).id)
}


// It's unclear if this will leave a session that can be restored.
// We might have to do it ourselves.
//#background
export async function qall(){
    let windows = await browser.windows.getAll()
    windows.map((window) => browser.windows.remove(window.id))
}

// }}}

// {{{ MISC

//#background
export function suppress(preventDefault?: boolean, stopPropagation?: boolean) {
    keydown.suppress(preventDefault, stopPropagation)
}

//#background
export function mode(mode: ModeType) {
    state.mode = mode
}

//#background
export async function getnexttabs(tabid: number, n?: number) {
    const curIndex: number = (await browser.tabs.get(tabid)).index
    const tabs: browser.tabs.Tab[] = await browser.tabs.query({
        currentWindow: true,
    })
    const indexFilter = ((tab: browser.tabs.Tab) => {
        return (
            curIndex <= tab.index &&
            (n ? tab.index < curIndex + Number(n) : true)
        )
    }).bind(n)
    return tabs.filter(indexFilter).map((tab: browser.tabs.Tab) => {
        return tab.id
    })
}

// Moderately slow; should load in results as they arrive, perhaps
// Todo: allow jumping to buffers once they are found
// Consider adding to buffers with incremental search
//      maybe only if no other results in URL etc?
// Find out how to return context of each result
//#background
/* export async function findintabs(query: string) { */
/*     const tabs = await browser.tabs.query({currentWindow: true}) */
/*     console.log(query) */
/*     const findintab = async tab => */
/*         await browser.find.find(query, {tabId: tab.id}) */
/*     let results = [] */
/*     for (let tab of tabs) { */
/*         let result = await findintab(tab) */
/*         if (result.count > 0) { */
/*             results.push({tab, result}) */
/*         } */
/*     } */
/*     results.sort(r => r.result.count) */
/*     console.log(results) */
/*     return results */
/* } */

// }}}

// {{{ CMDLINE

// TODO: These two don't really make sense as excmds, they're internal things.
//#content
export function showcmdline() {
    CommandLineContent.show()
    CommandLineContent.focus()
}

//#content
export function hidecmdline() {
    CommandLineContent.hide()
    CommandLineContent.blur()
}

/** Set the current value of the commandline to string */
//#background
export function fillcmdline(...strarr: string[]) {
    let str = strarr.join(" ")
    showcmdline()
    messageActiveTab("commandline_frame", "fillcmdline", [str])
}

//#background
export async function clipboard(excmd = "open", content = ""){
    switch (excmd) {
        case 'yank':
            await messageActiveTab("commandline_content", "focus")
            content = (content == "") ? (await activeTab()).url : content
            messageActiveTab("commandline_frame", "setClipboard", [content])
            break
        case 'open':
            await messageActiveTab("commandline_content", "focus")
            const url = await messageActiveTab("commandline_frame", "getClipboard")
            // todo: some url format and security check?
            url && browser.tabs.update(await activeTabID(), {url: url})
            break
        default:
            // todo: maybe we should have some common error and error handler
            throw new Error(`[clipboard] unknown excmd: ${excmd}`)
    }
    hidecmdline()
}

// {{{ Buffer/completion stuff
// TODO: Move autocompletions out of excmds.

/** @hidden */
//#background_helper
const DEFAULT_FAVICON = browser.extension.getURL("static/defaultFavicon.svg")

/** Buffer + autocompletions */
//#background
export async function openbuffer() {
    fillcmdline("buffer")
    messageActiveTab("commandline_frame", "changecompletions", [await listTabs()])
    showcmdline()
}

/** Change active tab */
//#background
export async function buffer(n?: number | string) {
    if (!n || Number(n) == 0) return // Vimperator index starts at 1
    if (n === "#") {
        n =
            (await browser.tabs.query({currentWindow: true})).sort((a, b) => {
                return a.lastAccessed < b.lastAccessed ? 1 : -1
            })[1].index + 1
    }
    tabSetActive(
        (await browser.tabs.query({
            currentWindow: true,
            index: Number(n) - 1,
        }))[0].id
    )
}

/** List of tabs in window and the last active tab. */
/** @hidden */
//#background_helper
async function getTabs() {
    const tabs = await browser.tabs.query({currentWindow: true})
    const lastActive = tabs.sort((a, b) => {
        return a.lastAccessed < b.lastAccessed ? 1 : -1
    })[1]
    tabs.sort((a, b) => {
        return a.index < b.index ? -1 : 1
    })
    console.log(tabs)
    return [tabs, lastActive]
}

/** innerHTML for a single Tab's representation in autocompletion */
/** @hidden */
//#background_helper
function formatTab(tab: browser.tabs.Tab, prev?: boolean) {
    let formatted = `<div> `,
        url = `<div class="url">`
    if (tab.active) formatted += "%"
    else if (prev) formatted += "#"
    if (tab.pinned) formatted += "@"
    formatted = formatted.padEnd(9)
    // TODO: Dynamically set favicon dimensions. Should be able to use em.
    formatted += tab.favIconUrl
        ? `<img src="${tab.favIconUrl}">`
        : `<img src="${DEFAULT_FAVICON}">`
    formatted += ` ${tab.index + 1}: ${tab.title}`
    url += `<a href="${tab.url}" target="_blank">${tab.url}</a></div></div>`
    return formatted + url
}

/** innerHTML for tab autocompletion div */
/** @hidden */
//#background_helper
async function listTabs() {
    let buffers: string = "",
        [tabs, lastActive] = await getTabs()
    for (let tab of tabs as Array<browser.tabs.Tab>) {
        buffers += tab === lastActive ? formatTab(tab, true) : formatTab(tab)
    }
    return buffers
}

// }}}

// }}}

/* SETTINGS */
//#background
export async function bind(...bindarr: string[]){
    let exstring = bindarr.slice(1,bindarr.length).join(" ")
    let key = bindarr[0]
    let nmaps = (await browser.storage.sync.get("nmaps"))["nmaps"]
    nmaps = (nmaps == undefined) ? {} : nmaps
    nmaps[key] = exstring
    browser.storage.sync.set({nmaps})
}

//#background
export async function unbind(key: string){
    bind(key)
}

/* Currently, only resets key to default after extension is reloaded */
//#background
export async function reset(key: string){
    bind(key)
    let nmaps = (await browser.storage.sync.get("nmaps"))["nmaps"]
    nmaps = (nmaps == undefined) ? {} : nmaps
    delete nmaps[key]
    browser.storage.sync.set({nmaps})
}


// vim: tabstop=4 shiftwidth=4 expandtab
