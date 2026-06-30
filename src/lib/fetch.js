import { CapacitorHttp } from "@capacitor/core"
import * as cheerio from "cheerio"
import * as xmlbuilder from "xmlbuilder"
import { SOARINGSPOT_URL, SOARSCORE_URL, GLIDEANDSEEK_URL } from "./consts.js"

async function fetchComps() {
	const res = await CapacitorHttp.get({ url: SOARINGSPOT_URL })
    if (res.status != 200) {
        console.log(res)
        throw new Error(`Failed to fetch SoaringSpot page: ${res.status} (Try restarting the app)`)
    }

    const $ = cheerio.load(res.data)

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

        if (comps.findIndex(c => c.name == name) == -1) {
            comps.push({ name, href })
        } else {
            console.log("DOUBLE FOUND: " + name)
        }
    })

    return comps
}

async function fetchCompTasks(compHref) {
    var tasks = []

    const res = await CapacitorHttp.get({ url: SOARSCORE_URL + "/competitions" + compHref })
    if (res.status != 200) {
        console.log(res)
        throw new Error("Failed to fetch competition tasks on " + res.url)
    }

    const $ = cheerio.load(res.data)

    const $taskDownloads = $("div#Downloads > p > a[download]")

    $taskDownloads.each((i, task) => {
        const $task = $(task).find("button")
        
        const hrefHttp = $(task).attr("href")
        const href = hrefHttp.replace("http://", "https://")

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
    const res = await CapacitorHttp.get({ url: SOARINGSPOT_URL + "/en_gb" + compHref + "downloads" })
    if (res.status != 200) {
        console.log(res)
        throw new Error("Failed to fetch competition waypoints on " + res.url)
    }

    const $ = cheerio.load(res.data)

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
    const res = await CapacitorHttp.get({ url: SOARINGSPOT_URL + "/en_gb" + compHref + "downloads" })
    if (res.status != 200) {
        console.log(res)
        throw new Error("Failed to fetch competition airspace on " + res.url)
    }

    const $ = cheerio.load(res.data)

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

async function fetchCompTasksSGSP(compHref) { // fetch tasks from soaringspot
    var tasks = []

    const res = await CapacitorHttp.get({ url: SOARINGSPOT_URL + "/en_gb" + compHref + "results" })
    if (res.status != 200) {
        console.log(res)
        throw new Error("Failed to fetch competiton tasks (SoaringSpot) on " + res.url)
    }

    const $ = cheerio.load(res.data)

    const $taskTables = $("table.result-overview")

    $taskTables.each((i, taskTable) => {
        const $taskTable = $(taskTable)

        const taskClass = $taskTable.find("thead > tr > th > a").text()
        const $taskRow = $taskTable.find("tbody > tr:first")

        const $taskLink = $taskRow.find("td > a:first")
        const href = SOARINGSPOT_URL + $taskLink.attr("href")
        const taskNum = $taskLink.text().split(" ")[1] // get the number after the space ("Task 9")

        const dateRaw = $taskRow.find("td:first").text() // DD/MM/YYYY
        const dateParts = dateRaw.split("/")
        const dateObject = new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0])
        const taskDate = new Intl.DateTimeFormat('en-GB', { year: "numeric", month: "long", day: "numeric" }).format(dateObject)

        if (taskClass) {
            tasks.push({
                href,
                taskClass,
                // taskDay,
                taskNum,
                taskDate
            })
        }
    })

    console.log("Fetching tasks form " + SOARINGSPOT_URL)
    console.log(tasks)

    return tasks
}

async function generateCompTask(taskHref) {
    const resJSON = await CapacitorHttp.get({ url: GLIDEANDSEEK_URL + taskHref })
    if (resJSON.status != 200) {
        console.log(resJSON)
        throw new Error("Failed to fetch JSON task from " + resJSON.url)
    }

    const taskJSON = resJSON.data.message
    
    const resTaskPage = await CapacitorHttp.get({ url: taskHref })
    if (resTaskPage.status != 200) {
        console.log(resTaskPage)
        throw new Error("Failed to fetch task page from " + resTaskPage.url)
    }

    const $ = cheerio.load(resTaskPage.data)

    const $taskDuration = $("div.task-duration")
    const isAAT = $taskDuration.length != 0

    var aatMinTime
    if (isAAT) {
        const taskDurationHMS = $taskDuration.find("span>strong").text()
        var HMS = taskDurationHMS.split(":", 3)

        if (HMS.length < 3) {
            while (HMS.unshift("0") != 3) {}
        }

        aatMinTime = (parseInt(HMS[0]) * 3600) + (parseInt(HMS[1]) * 60) + parseInt(HMS[2])
    }

    const taskAttr = isAAT ? { type: "AAT", aat_min_time: aatMinTime } : { type: "RT" }

    var taskXML = xmlbuilder.begin().ele("Task", { ...taskAttr, fai_finish: "0" } )

    taskJSON.points.forEach((point, i) => {
        var pointXML = taskXML.ele("Point", { type: i == 0 ? "Start" : (i == taskJSON.points.length - 1 ? "Finish" : (isAAT ? "Area" : "Turn")) })

        var obsZoneAttr = (point.type == "Line") ? { length : (point.radius * 2).toFixed(1) } 
            : ((point.type == "Symmetric") ? { length : point.radius.toFixed(1) } : { radius: point.radius.toFixed(1) } )

        pointXML
            .ele("Waypoint", { altitude: point.altitude, name: point.name })
            .ele("Location", { latitude: point.lat, longitude: point.lng })
        pointXML
            .ele("ObservationZone", { type: (point.type == "Symmetric" ? "Keyhole" : point.type), ...obsZoneAttr })
    })

    const task = taskXML.end({ pretty: true, indent: "\t" })
    console.log(task)

    return task
}

export { fetchComps, fetchCompTasks, fetchCompWaypoints, fetchCompAirspace, fetchCompTasksSGSP, generateCompTask }