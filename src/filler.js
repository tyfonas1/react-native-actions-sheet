import React, { useEffect } from "react";
import {
	View, DeviceEventEmitter
} from "react-native";
import { HEIGHT_CHANGE_EVENT } from "react-native-actions-sheet/src/utils";

export const BlankFiller = React.memo(() => {
	const [height,setHeight] = React.useState(0)

	const onHeightChange = (height) => {
		setHeight(height * 1.1)
	}

	useEffect(() => {
		DeviceEventEmitter.addListener(HEIGHT_CHANGE_EVENT,onHeightChange);

		return () => {
			DeviceEventEmitter.removeListener(HEIGHT_CHANGE_EVENT,onHeightChange)
		} 
	},[])

return <View
	style={{
	  height: height,
	  width: "100%",
	  zIndex: 10,
	}}
	pointerEvents="none"
  >

  </View>
  },() => true )