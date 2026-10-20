# How Context Heavy Diagrams compares with other tools

> **Draft.** Only some categories are written so far. It is not linked from the README yet.

This is an honest map of where this tool fits among the diagramming tools in use today, and where another one is the better choice. It describes what each tool does, not which is "best": they are built for different jobs.

**What this tool is:** a local, offline desktop editor where you draw the diagram yourself on a canvas. Each element can carry Markdown notes, tags, images and a link to a deeper diagram, which opens as its own file. Diagrams are plain, diff-friendly text files. There is no server, no account, and no fixed notation.

Facts about other tools were checked on 2026-10-20 against each tool's own documentation, linked in each section. Tools change; if something here is out of date, please open an issue. Prices are left out on purpose.

## General diagram editors

**draw.io, yEd, Lucidchart, Visio, Miro and FigJam** are drawing tools where you place shapes and connectors by hand, like this tool, but for any purpose and usually with far larger shape libraries.

| Tool | What it is |
|---|---|
| [draw.io](https://www.drawio.com/) | Free, with Apache 2.0 licensed source for the web app ([repository](https://github.com/jgraph/drawio)). Runs in the browser, as a desktop app, as a VS Code extension, and inside Confluence, Jira, GitHub repositories and several other tools. Exports SVG, PNG and PDF. The desktop app is GPL-3.0 and is "designed to be completely isolated from the Internet" apart from its update check ([desktop repository](https://github.com/jgraph/drawio-desktop)). Diagrams can be saved as uncompressed XML ([how](https://www.drawio.com/doc/faq/export-to-xml)). |
| [yEd](https://www.yworks.com/products/yed) | A free Java desktop editor with automatic layout algorithms that arrange large diagrams at the press of a button. Imports Excel and XML; exports PNG, JPG, SVG, PDF and SWF. |
| [Lucidchart](https://lucid.co/product/lucidchart) | A commercial editor with many diagram types, including enterprise architecture, cloud architecture and user journey maps. Links diagrams to data with conditional formatting, generates diagrams from imports (org charts from spreadsheets, ERDs from SQL, cloud diagrams from cloud account data), supports Mermaid, has AI generation, assisted layout and swimlanes, and lists over 100 integrations including Confluence, Jira and Microsoft and Google apps. |
| [Visio](https://www.microsoft.com/en-us/microsoft-365/visio/flowchart-software) | Microsoft's diagram editor. Visio for the web comes with Microsoft 365 commercial plans (with limited templates) or Visio Plan 1; the desktop app with offline, local file support is in Plan 2; non-subscription versions also exist. Integrates with Teams, Power BI, Excel, Word and PowerPoint. Data linking is available only in the desktop app. Includes BPMN 2.0, network, floor plan and Azure and AWS architecture shapes in the paid plans. |
| [Miro](https://miro.com/diagramming/) | A collaborative whiteboard workspace with a diagramming tool. Specialised shape libraries (BPMN, UML, ERD, cloud architecture) are on paid plans, AI generates diagrams from a prompt, and it imports Visio, draw.io and Lucidchart files. Diagrams can be embedded in Confluence. |
| [FigJam](https://www.figma.com/figjam/) | Figma's collaborative whiteboard, with shapes and connectors, flowchart templates and integrations with Asana, Jira and GitHub. |

**Where they are better**
- **Reach and polish.** Large shape and icon libraries, hundreds or thousands of templates, standard notations (BPMN, UML, ERD) and mature import and export, including from each other.
- **Collaboration.** Visio (on the web and in Teams), Miro and FigJam are built around several people working on the same board or diagram at once.
- **Data and automation.** Lucidchart and Visio link shapes to spreadsheets and databases; Lucidchart builds diagrams from imports; yEd and Lucidchart lay diagrams out automatically.
- **Where people read.** Confluence, Jira, Microsoft 365 and Google Workspace integrations, and SVG or PDF export, so a diagram can sit inside a document.

**Where this tool is better**
- **Context behind each element.** Notes, tags, images and a link to a deeper diagram live on the element, and the deeper diagram opens as its own file. This is the core of the design here, not an add-on.
- **Diagrams as ordinary text files** that are small, stable and meant to be reviewed in git, with the file format published as a standalone specification.
- **Offline and account-free by design.** The app blocks its own network access. draw.io's desktop app is also isolated apart from update checks, while Miro and FigJam are workspaces built around shared online boards.
- **A narrow, consistent set of rules** (a node is one thing, edges stay attached) instead of a large toolbox.

**Choose them** when several people edit the same diagram, when you need standard notations and big template libraries, or when the diagram has to appear in Confluence, Office or a slide deck. **draw.io** is the closest free alternative and the one to try first if you only need a flexible editor. **Choose this tool** when the notes and drill-down behind the picture are the point, you want the diagram in git as a readable file, and nothing may leave the computer.

**Mermaid, PlantUML, D2, Graphviz and Eraser** describe a diagram in text and draw it for you.

| Tool | What it is |
|---|---|
| [Mermaid](https://mermaid.js.org/intro/) | A JavaScript library with Markdown-inspired text definitions, MIT licensed. Many diagram types, including flowcharts, sequence, user journey, C4 and architecture. |
| [PlantUML](https://plantuml.com/) | Text descriptions for UML and many other diagram types (it lists ArchiMate among them). Graphviz is the default layout engine for some diagram types, with other engines offered. Distributed under the GPL, with several other licences listed ([FAQ](https://plantuml.com/faq)). |
| [D2](https://d2lang.com/tour/intro/) | A declarative diagram language with a command-line tool and a watch mode. Exports SVG, PNG, PDF, PPTX, GIF and plain text ([exports](https://d2lang.com/tour/exports/)). Three layout engines: dagre (the default), ELK and TALA ([layouts](https://d2lang.com/tour/layouts/)). |
| [Graphviz](https://graphviz.org/about/) | Open source layout programs that read a text description and produce images and SVG. Other tools, PlantUML among them, use it for layout. |
| [Eraser](https://www.eraser.io/pricing) | A commercial service that combines diagram-as-code with a canvas, AI generation and real-time collaboration. Exports PDF, PNG, SVG and Markdown. |

**Where they are better**
- **Speed and layout.** You write the relationships and the tool places everything. A text change is a one-line diff in review.
- **Native rendering where people read.** Mermaid renders in GitHub, GitLab, Notion, Obsidian, Azure DevOps wikis and others without anything exported ([integrations](https://mermaid.js.org/ecosystem/integrations-community.html)). A diagram in a README is just text.
- **Scale and automation.** Diagrams can be generated from other data, and checked in a build.

**Where this tool is better**
- **You control the picture.** Position, grouping, routing and styling are exactly what you drew, which matters when the layout carries meaning or the engine's result is not readable. The text tools' automatic layout cannot always be steered; D2, for example, gives full placement control (locked positions) only in one of its three engines.
- **Context stays behind the element.** Notes, tags, images and a link to a deeper diagram are fields on the element, instead of extra text in the source or a separate document.
- **Drill-down across files** with no tooling beyond opening the linked diagram.

**Choose the code tools** when the diagram should render inside a README or wiki from text, be generated from data, or be written fast without caring where each box lands. **Choose this tool** when layout and per-element context matter more than speed of writing.

## Software architecture models

**Structurizr, LikeC4 and IcePanel** keep a model of the system and generate several diagrams (views) from it, mostly around the C4 model.

| Tool | What it is |
|---|---|
| [Structurizr](https://docs.structurizr.com/) | "Models as code" for C4, written in its own DSL, by the author of C4 and described as the reference implementation. Views can use automatic layout ([DSL](https://docs.structurizr.com/dsl/language)). Exports PlantUML, Mermaid, a static HTML site, PNG, SVG and JSON ([export](https://docs.structurizr.com/export)). The `local` command is free and open source, but reachable only on localhost and without collaboration features; `server` needs a licence for the prebuilt binaries ([local](https://docs.structurizr.com/local)). Its documentation lists the cloud service, Lite, on-premises and CLI as end of life. |
| [LikeC4](https://likec4.dev/) | An open source (MIT) "architecture as code" tool with its own DSL and interactive views that drill down. `likec4 build` makes a static site; diagrams can be embedded through React, Web Components or a Vite plugin; its CLI exports PNG, JPEG, JSON and draw.io and generates Mermaid, D2, Dot and PlantUML ([CLI](https://likec4.dev/tooling/cli/)). It also offers an MCP server and an API. |
| [IcePanel](https://icepanel.io/) | A hosted, collaborative modelling tool for software architecture, with a shared model of domains, systems and flows and several levels of detail. Viewers are unlimited and free, and paid plans are priced per editor ([pricing](https://icepanel.io/pricing)). Embeds live diagrams in Confluence ([integration](https://icepanel.io/integrations/confluence)). |

**Where they are better**
- **One model, many consistent views.** A change to a system appears in every diagram that shows it. Here each diagram is its own file; nothing stops two diagrams from disagreeing.
- **Checks and automation.** LikeC4 validates a model and its layout in CI and formats files; Structurizr exports to other formats.
- **Sharing.** A static site, embedded components, or a live embed in Confluence, with collaboration in IcePanel.

**Where this tool is better**
- **No model to learn or maintain.** You draw a diagram and it is done, for any subject, with no fixed levels or notation.
- **Fully offline and free of accounts.** Nothing runs on a server and nothing leaves the computer.
- **Per-element notes, tags and images** next to the drawing, and your own layout.

**Choose these** when you want an architecture model that several diagrams share, or diagrams published to a team or a wiki. **Choose this tool** when you want a flexible drawing with its context behind it, not a model.

## Enterprise architecture platforms

**Ardoq, SAP LeanIX, Bizzdesign and Archi** keep an organisation's architecture (applications, capabilities, teams, processes, technology and how they depend on each other) as data in a repository, and draw diagrams and reports from it.

| Tool | What it is |
|---|---|
| [Ardoq](https://www.ardoq.com/) | A SaaS enterprise architecture platform with a central repository that maps dependencies across applications, teams and processes. Reports and dashboards that update as the data does, future-state scenarios and roadmaps, APIs and integrations, an MCP server, and AI that pulls data from documents and flags duplicate, unused and outdated applications. Aimed at enterprise architects, IT leaders, PMOs and security architects. |
| [SAP LeanIX](https://www.leanix.net/en/) | An enterprise architecture platform for application portfolio management, technology risk and compliance, and architecture and roadmap planning. Its metamodel is based on industry practice, so there is no taxonomy to design. Connects to CMDBs, Jira, GitHub and custom APIs, and has an AI assistant and an MCP server. |
| [Bizzdesign](https://bizzdesign.com/) | A SaaS suite covering enterprise architecture, application and strategic portfolio management, business architecture, process management and governance, risk and compliance, with AI features. Aims to give business and IT "a shared language". |
| [Archi](https://www.archimatetool.com/) | A free, open source (MIT) cross-platform editor for ArchiMate models, written in Java. [ArchiMate](https://www.opengroup.org/archimate-forum/archimate-overview) is an Open Group standard modelling language for enterprise architecture. The coArchi plug-in shares and versions Archi models in a Git repository, and is described as a work in progress ([coArchi](https://github.com/archimatetool/archi-modelrepository-plugin)). |

For a market view, Gartner's 2026 Magic Quadrant for Enterprise Architecture Tools covers Ardoq, Bizzdesign, SAP LeanIX and Sparx Systems, among others ([abstract](https://www.gartner.com/en/documents/8502677)).

**Where they are better**
- **A real model.** The elements and relationships are data that can be queried, reported on, validated and kept current from other systems (CMDBs, cloud accounts, ticket trackers). A diagram is one view of that data and stays tied to it.
- **Analysis and governance.** Dependency and lifecycle analysis, dashboards, roadmaps and future-state scenarios, ownership and compliance tracking, and AI over the whole repository.
- **Many people, one landscape.** They are built for an architecture team and the rest of the organisation to work in the same repository.
- **A standard notation.** Archi is built around ArchiMate, so models follow a notation that architects and other tools recognise.

**Where this tool is better**
- **No metamodel to adopt or maintain.** You can start drawing straight away, in any style, for any subject.
- **Not tied to enterprise architecture.** The same tool draws a process, a customer journey or a system design.
- **Free, offline and file-based.** Nothing to license, host or connect, and diagrams that live in git next to the code.
- **Context behind each element and drill-down between files**, with tags and highlights giving a light version of a data view.

**Choose these** when the question is "what do we have, who owns it and what breaks if it changes" across a whole organisation, or when you must follow ArchiMate. **Choose this tool** for architecture diagrams that tell a story, for landscapes documented by hand before an enterprise architecture platform is justified, or next to one. This tool does not try to replace these platforms, and on what they do they are the stronger choice.

## Customer journey and process tools

**UXPressia and Smaply** are built for customer journeys. **Camunda Modeler, bpmn.io and Bizagi Modeler** are built for business processes in BPMN.

| Tool | What it is |
|---|---|
| [UXPressia](https://uxpressia.com/) | An online customer experience mapping platform: journey maps, personas, service blueprints and impact maps, with real-time collaboration, tags and statuses, team libraries and AI features. Pulls in web analytics and voice-of-the-customer data. Exports PNG, PDF, CSV and PPTX. |
| [Smaply](https://www.smaply.com/) | Customer journey management software: journey maps, service blueprints and personas, a research hub, journey hierarchies with ownership and governance, a portfolio for prioritising what to fix, and CX metrics shown in the journey. Lists 20+ integrations and commenting and co-editing. |
| [Camunda Modeler](https://camunda.com/platform/modeler/) | A free and open source desktop BPMN modeller, also available as a collaborative web application in Camunda 8. A diagram can be published to the Camunda platform, where it becomes a running process. |
| [bpmn.io](https://bpmn.io/) | Web toolkits for BPMN, DMN and forms, built and maintained by Camunda and contributors. `bpmn-js` displays BPMN 2.0 diagrams and can be embedded as a web modeller in other applications. |
| [Bizagi Modeler](https://www.bizagi.com/en/platform/modeler) | Process modelling with a free tier that publishes to PDF, Word, Excel, the web and SharePoint, imports from Visio, IBM Blueworks, XPDL and BPMN, and simulates processes. A paid tier adds process mining, a shared process library and automation. |

[BPMN](https://www.omg.org/spec/BPMN/2.0.2/About-BPMN) is a standard notation maintained by the Object Management Group; its current formal specification is version 2.0.2. The general editors above cover parts of this too: Lucidchart lists user journey maps among its diagram types, and Visio (in its higher plan) and Miro (on paid plans) include BPMN shapes.

**Where they are better**
- **Purpose-built structure.** Personas, service blueprints, journey metrics and research on the journey side; correct BPMN notation on the process side, interchangeable between tools.
- **Linked to data and to running systems.** Journey tools bring in analytics and customer feedback; Camunda turns a BPMN diagram into a process that runs and can be monitored.
- **Team workflow.** Collaboration, ownership, prioritisation and publishing for people who are not diagram authors.

**Where this tool is better**
- **Any journey or process, in any shape.** A journey is a sequence of boxes with notes and tags behind each step, with no fixed template to fit. The gallery has one ([customer journey](../examples/gallery/business/customer-journey.chd)).
- **Links into the rest of the picture.** A step can link to the system diagram behind it, so a business view and a technical view stay connected.
- **BPMN as a visual vocabulary only.** Process diagrams can use BPMN's recognisable conventions with an icon and a label on ordinary elements, with nothing validated or executed ([ADR 0080](decisions/0080-bpmn-as-adopted-vocabulary-not-metamodel.md)). The tool does not read or write BPMN files.
- **Free, offline and file-based.**

**Choose the journey tools** when you run a journey programme with personas, research, metrics and a team working in it. **Choose a BPMN tool** when the diagram must follow the standard, be exchanged with other tools or run on a process engine. **Choose this tool** for a quick, flexible journey or process sketch, or when the story behind each step and its link to the system diagrams matter more than the notation.

## Getting diagrams into wikis and documentation

Embedding is the weakest part of this tool. The only way out of it today is an exported **PNG**. There is no SVG export, no command-line export (so an image cannot be regenerated in CI), and no wiki plugin.

| Tool | How a diagram reaches a wiki or README |
|---|---|
| This tool | PNG export from the app. |
| draw.io | SVG, PNG and PDF export, plus plugins and integrations for Confluence, Jira, GitHub repositories and Markdown, and Notion through a Chrome extension. |
| Lucidchart | Integrations listed for Confluence and Jira, and for Microsoft and Google apps. |
| Visio | Teams, Power BI, Excel, Word and PowerPoint. |
| Miro | Embedding in Confluence, and PDF and JPG export. |
| yEd | PNG, JPG, SVG, PDF and SWF export. |
| UXPressia | PNG, PDF, CSV and PPTX export. |
| Bizagi Modeler | Publishing to PDF, Word, Excel, the web and SharePoint. |
| Mermaid | Native rendering in GitHub, GitLab, Notion, Obsidian and others; Confluence through third-party Marketplace apps, none of them native. |
| PlantUML | SVG or PNG output; its site lists editing options for DokuWiki, AsciiDoc and Markdown. |
| D2 | SVG, PNG, PDF and others from the command line. |
| Eraser | Integrations with GitHub, Notion, Confluence and VS Code listed on every plan. |
| Structurizr | Static HTML site, PNG and SVG export. |
| LikeC4 | Static site, React and Web Components, PNG and JPEG export. |
| IcePanel | Live embed in Confluence. |

SVG export and a command-line export are the natural first steps. The aim is that a repository can hold the `.chd` file and let CI regenerate the image whenever it changes.
