import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  scrollView: {
    height: "100%",
    width: "100%",
    backgroundColor: "transparent",
  },
  container: {
    width: "100%",
    backgroundColor: "white",
    alignSelf: "center",
  },
  indicator: {
    height: 6,
    width: 45,
    borderRadius: 100,
    backgroundColor: "#f0f0f0",
    marginVertical: 5,
    marginTop: 10,
    alignSelf: "center",
  },
  parentContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 999,
    elevation: 10,
  },
  keyboardView:{
    width: "100%",
    height: "100%",
  },
  safeArea:{
    width: "100%",
    height: "100%",
    position: "absolute",
    backgroundColor: "transparent",
  },
  safeAreaChild:{
    width: "100%",
    height: "100%",
  }
});
