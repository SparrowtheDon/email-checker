document.getElementById("checkButton").addEventListener("click", async () => {
  const email = document.getElementById("emailInput").value.trim();
  const result = document.getElementById("singleResult");

  if (!email) return (result.textContent = "Please enter an email.");

  result.textContent = "Checking...";
  const response = await fetch("/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();
  result.textContent = `Status: ${data.status || "Error"} | Sub-status: ${
    data.sub_status || "N/A"
  }`;
});

// Handle CSV upload
document.getElementById("uploadButton").addEventListener("click", async () => {
  const fileInput = document.getElementById("csvFile");
  const bulkResults = document.getElementById("bulkResults");
  const downloadButton = document.getElementById("downloadButton");

  if (!fileInput.files.length)
    return (bulkResults.textContent = "Please upload a CSV file first.");

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  bulkResults.textContent = "Uploading and verifying...";
  downloadButton.style.display = "none";

  const response = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  // Display results
  bulkResults.innerHTML = `<h3>Results:</h3><ul>${data
    .map(
      (r) =>
        `<li>${r.email}: <strong>${r.status}</strong> (${r.sub_status})</li>`
    )
    .join("")}</ul>`;

  // Store data for CSV download
  window.lastResults = data;
  downloadButton.style.display = "inline-block";
});

// Handle CSV download
document.getElementById("downloadButton").addEventListener("click", () => {
  const results = window.lastResults;
  if (!results || results.length === 0) return alert("No results to download.");

  const csvRows = [
    ["Email", "Status", "Sub-status"],
    ...results.map((r) => [r.email, r.status, r.sub_status]),
  ];

  const csvContent = csvRows.map((e) => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "verification_results.csv";
  link.click();
});
