export default (source, actions) => {
  source.addEventListener("message", ({ data }) => {
    const { id, message } = JSON.parse(data);
    actions[id](message);
  });
  source.addEventListener("open", () => console.log("Connected"), false);
  source.addEventListener("error", (e) => {
    if (e.eventPhase == EventSource.CLOSED) source.close();
    if (e.target.readyState == EventSource.CLOSED) {
      console.log("Disconnected");
    } else if (e.target.readyState == EventSource.CONNECTING) {
      console.log("Connecting...");
    }
  });
};
