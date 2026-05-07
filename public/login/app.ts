function login(event: any) {
  event.preventDefault();
  const masterKey = document.getElementById("masterKey");
  if (masterKey) {
    // @ts-ignore
    sessionStorage.setItem("masterKey", masterKey.value);
    // @ts-ignore
    document.cookie = `masterKey=${encodeURIComponent(masterKey.value)}; path=/; SameSite=Strict`;
    window.location.href = "/admin";
  }
}
