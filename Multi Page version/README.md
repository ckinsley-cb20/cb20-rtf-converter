# RTF to PTF Converter

A lightweight, smart React application designed to convert Rich Text Format (RTF) to Plain Text Format (PTF). 

Unlike standard plain text converters that destroy formatting, this tool utilizes a custom DOM parser to explicitly preserve bulleted lists, numbered lists, indents, and table structures while stripping away messy, hidden HTML (especially artifacts from Microsoft Word and Outlook).

## ✨ Features

* **Smart List Parsing:** Automatically calculates nesting depth for `<ul>` and `<ol>` lists, converting them into perfectly indented plain text bullets (`•`) or numbers (`1.`).
* **Table Preservation:** Detects table rows and cells (`<tr>`, `<td>`), injecting invisible tabs (`\t`) so copied spreadsheets maintain their column alignment in plain text.
* **Microsoft Word Cleanup:** Automatically detects and removes ghost lines, trailing tabs, and erratic 4-space bullet gaps common when pasting from Microsoft Office products.
* **Interactive Editing:** The plain text output box acts as a smart editor. 
  * Pressing `Tab` inserts a 4-space indent instead of jumping off the page.
  * Pressing `Enter` while inside a list automatically generates the next bullet or number.
  * Pressing `Shift + Enter` injects a perfect hanging indent to align wrapped text.
* **Universal Copy:** Includes a secure-context copy function with a built-in DOM fallback to bypass restrictive iframe or permission policy errors.

## 🛠️ Tech Stack

* **Framework:** React + Vite
* **Styling:** Tailwind CSS (v3)
* **Icons:** Lucide-React

## 🚀 How to Run Locally

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd rtf-converter
