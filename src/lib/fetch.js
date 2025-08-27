import * as cheerio from "cheerio";
import { SOARINGSPOT_URL, SOARSCORE_URL } from "./consts.js";

async function fetchComps() {
	const res = await fetch(SOARINGSPOT_URL)
	if (!res.ok) throw new Error("Failed to fetch SoaringSpot page")

	const html = await res.text()
	const $ = cheerio.load(html)

    const $rows = $("div.contest")

    var comps = []
    $rows.each((i, row) => {
        const $row = $(row)

        const $link = $row.find("h3").find("a")
        // const $info = $row.find("div.info")


        const name = $link.text().trim()
        var href = $link.attr("href")
        href = href.substring(6) // /en_gb/competition/ -> /competition/

        console.log({ name, href })
        comps.push({ name, href })
    })

    return comps
}

async function fetchCompTasks(compHref) {
    var tasks = []

    const res = await fetch(SOARSCORE_URL + "/competitions" + compHref)
    if (!res.ok) throw new Error("Failed to fetch competition tasks on " + SOARSCORE_URL + "/competitions" + compHref)

    const html = await res.text()
    const $ = cheerio.load(html)

    const $taskDownloads = $("div#Downloads > p > a[download]")

    $taskDownloads.each((i, task) => {
        const $task = $(task).find("button")
        
        const href = $(task).attr("href")

        const $title = $task.find("span > strong")
        $title.find("svg").remove()

        const title = $title.text()
        const taskClass = title.substring(0, title.lastIndexOf("Day")).trim()

        const dayMatch = title.match(/Day(\d+)/)
        const numMatch = title.match(/Task(\d+)/)

        const taskDay = dayMatch ? dayMatch[1] : ""
        const taskNum = numMatch ? numMatch[1] : ""

        $task.find("span").remove()
        $task.find("br").remove()

        var taskDate = $task.text()
        taskDate = taskDate.substring(taskDate.indexOf(".tsk generated:") + 15).trim()
        
        tasks.push({
            href,
            taskClass,
            taskDay,
            taskNum,
            taskDate
        })
    })

    return tasks
}

async function fetchCompWaypoints(compHref) {
    const res = await fetch(SOARINGSPOT_URL + "/en_gb" + compHref + "downloads")
    if (!res.ok) throw new Error("Failed to fetch competition waypoints on " + SOARINGSPOT_URL + compHref + "downloads")

    const html = await res.text()
    const $ = cheerio.load(html)

    const $waypointsUl = $("ul.contest-downloads:last")
    const $waypointsLinks = $waypointsUl.find("li>a")
    $waypointsLinks.find("i").remove()

    const $waypointsLink = $waypointsLinks.filter((i, el) => {
        return $(el).text().includes(".cup")
    }).first()

    const href = $waypointsLink.attr("href")

    console.log(href)
    return href
}

async function fetchCompAirspace(compHref) {
    const res = await fetch(SOARINGSPOT_URL + "/en_gb" + compHref + "downloads")
    if (!res.ok) throw new Error("Failed to fetch competition airspace on " + SOARINGSPOT_URL + compHref + "downloads")

    const html = await res.text()
    const $ = cheerio.load(html)

    const $airspaceUl = $("ul.contest-downloads:first")
    const $airspaceLinks = $airspaceUl.find("li>a")
    $airspaceLinks.find("i").remove()

    const $airspaceLink = $airspaceLinks.filter((i, el) => {
        return $(el).text().includes(".txt")
    }).first()

    const href = $airspaceLink.attr("href")

    console.log(href)
    return href
}

export { fetchComps, fetchCompTasks, fetchCompWaypoints, fetchCompAirspace }