
// Replace this with your deployed backend URL, without a trailing slash.
// Example format: https://your-backend.example.com
const API_BASE_URL = "https://YOUR-BACKEND-URL";

const packages = {
  pc: { name: "PC / Laptop Tweaks", price: 8.99, icon: "▣" },
  ps: { name: "PlayStation Tweaks", price: 8.99, icon: "◈" },
  xbox: { name: "Xbox Tweaks", price: 8.99, icon: "X" }
};

const params = new URLSearchParams(window.location.search);
const productKey = params.get("product");
const selectedPackage = packages[productKey];

const form = document.getElementById("checkoutForm");
const statusBox = document.getElementById("formStatus");
const submitButton = document.getElementById("submitOrder");

function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `form-status show ${type}`;
}

if (!selectedPackage) {
  document.getElementById("summaryName").textContent = "No package selected";
  document.getElementById("summaryIcon").textContent = "?";
  submitButton.disabled = true;
  showStatus("Please return to the packages page and select a package.", "error");
} else {
  document.getElementById("summaryName").textContent = selectedPackage.name;
  document.getElementById("summaryIcon").textContent = selectedPackage.icon;
  document.getElementById("summaryPrice").textContent = `$${selectedPackage.price.toFixed(2)}`;
  document.getElementById("summaryTotal").textContent = `$${selectedPackage.price.toFixed(2)}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedPackage) return;

  if (API_BASE_URL.includes("YOUR-BACKEND-URL")) {
    showStatus("The order system is not connected yet. Please try again after the backend is set up.", "error");
    return;
  }

  const formData = new FormData(form);
  const order = {
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    discord: String(formData.get("discord") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    paymentMethod: String(formData.get("paymentMethod") || ""),
    notes: String(formData.get("notes") || "").trim(),
    product: productKey
  };

  if (!order.name || !order.email || !order.paymentMethod) {
    showStatus("Please complete all required fields.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Sending request...";
  statusBox.className = "form-status";

  try {
    const response = await fetch(`${API_BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "The order request could not be sent.");
    }

    form.reset();
    showStatus("Your order request was sent. Please wait for the team to contact you to confirm the details. No payment has been taken.", "success");
  } catch (error) {
    showStatus(error.message || "Something went wrong. Please try again later.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send Order Request →";
  }
});
