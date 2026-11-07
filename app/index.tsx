import { StyleSheet, Text, View } from "react-native";

export default function StartupTest() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lotty Go</Text>
      <Text style={styles.message}>Android startup test passed.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  title: {
    color: "#F5B400",
    fontSize: 36,
    fontWeight: "800",
  },
  message: {
    color: "#222222",
    fontSize: 16,
    marginTop: 12,
  },
});
