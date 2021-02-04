import PropTypes from "prop-types";
import React, { Component, createRef } from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  Modal,
  Platform,
  Animated,
  DeviceEventEmitter,
  ViewPropTypes,
  FlatList,
  Keyboard,
  TextInput,
  StatusBar,
  findNodeHandle,
  SafeAreaView,
  KeyboardAvoidingView,
} from "react-native";
import { BlankFiller } from "./filler";
import { styles } from "./styles";
import {
  getDeviceHeight,
  SUPPORTED_ORIENTATIONS,
  getElevation,
  waitAsync,
  HEIGHT_CHANGE_EVENT,
} from "./utils";

let safeareaHeight;
let innerViewHeight;
let calculatedDeviceHeight;

export default class ActionSheet extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modalVisible: false,
      scrollable: false,
      layoutHasCalled: false,
      keyboard: false,
      portrait: true,
      deviceHeight: getDeviceHeight(this.props.statusBarTranslucent),
      deviceWidth: Dimensions.get("window").width,
    };
    this.actionSheetHeight;
    this.prevScroll;
    this.scrollAnimationEndValue;
    this.hasBounced;
    this.layoutHasCalled = false;
    this.isClosing = false;
    this.isRecoiling = false;
    this.targetId = null;
    this.offsetY = 0;
    this.currentOffsetFromBottom = this.props.initialOffsetFromBottom;

    safeareaHeight = getDeviceHeight(this.props.statusBarTranslucent);
    innerViewHeight = getDeviceHeight(this.props.statusBarTranslucent);
    this.scrollViewRef = createRef();

    this.transformValue = new Animated.Value(0);
    this.opacityValue = new Animated.Value(0);
    this.underlayScale = new Animated.Value(1);
    this.underlayTranslateY = new Animated.Value(100);
    this.borderRadius = new Animated.Value(10);
    this.transformValueC = new Animated.Value(0);
    this.openAfterClosing = false;
    this.layoutTime = null;

    this.viewA = createRef();
    this.viewB = createRef();
    this.viewC = createRef();
    this.viewD = createRef();
  }

  /**
   * Snap ActionSheet to Offset
   */

  snapToOffset = (offset) => {
    this._scrollTo(offset);
  };

  /**
   * Open the ActionSheet
   */
  show = () => {
    this.setModalVisible(true);
  };

  /*
   * Close the ActionSheet
   */
  hide = () => {
    this.setModalVisible(false);
  };

  /**
   * Open/Close the ActionSheet
   */
  setModalVisible = (visible) => {
    if (this.isClosing) {
      this.openAfterClosing = true;
    }

    let modalVisible = this.state.modalVisible;
    if (visible !== undefined) {
      if (modalVisible === visible) {
        return;
      }
      modalVisible = !visible;
    }
    if (!modalVisible) {
      this.setState({
        modalVisible: true,
        scrollable: this.props.gestureEnabled,
      });
    
    } else {
      this._hideModal();
    }
  };

  _hideAnimation() {
    let {
      animated,
      closeAnimationDuration,
      onClose,
      bottomOffset,
      initialOffsetFromBottom,
      extraScroll,
      closable,
    } = this.props;

    Animated.parallel([
      Animated.timing(this.opacityValue, {
        toValue: closable ? 0 : 1,
        duration: animated ? closeAnimationDuration : 1,
        useNativeDriver: true,
      }),
      Animated.timing(this.transformValue, {
        toValue: closable ? this.actionSheetHeight * 2 : 0,
        duration: animated ? closeAnimationDuration : 1,
        useNativeDriver: true,
      }),
    ]).start();

    waitAsync(closeAnimationDuration / 1.5).then(
      () => {
        let scrollOffset = closable
          ? 0
          : this.actionSheetHeight * initialOffsetFromBottom +
            this.state.deviceHeight * 0.1 +
            extraScroll -
            bottomOffset;

        this._scrollTo(scrollOffset, !closable);
        this.currentOffsetFromBottom = initialOffsetFromBottom;
        this.setState(
          {
            modalVisible: !closable,
          },
          () => {
            this.isClosing = false;
            if (this.openAfterClosing) {
              this.openAfterClosing = false;
              this.show();
            }
            DeviceEventEmitter.emit("hasReachedTop", false);
            if (closable) {
              this.layoutHasCalled = false;
              if (typeof onClose === "function") onClose();
            }
          }
        );
      }
    );
  }

  _hideModal = () => {
    if (this.isClosing) return;
    this.isClosing = true;
    this._hideAnimation();
  };

  _showModal = async (event) => {
    let {
      gestureEnabled,
      delayActionSheetDraw,
      delayActionSheetDrawTime,
    } = this.props;
    if (!event?.nativeEvent) return;
    let height = event.nativeEvent.layout.height;

    if (this.layoutHasCalled) {
      this._returnToPrevScrollPosition(height);
      this.actionSheetHeight = height;
      this._showHideTopUnderlay(
        this.actionSheetHeight * this.currentOffsetFromBottom
      );
      return;
    } else {
      this.actionSheetHeight = height;

      let scrollOffset = this.getInitialScrollPosition();

      if (Platform.OS === "ios" || delayActionSheetDraw) {
        await waitAsync(delayActionSheetDrawTime);
      }
      this._scrollTo(scrollOffset, false);
      this.prevScroll = scrollOffset;
      if (Platform.OS === "ios" || delayActionSheetDraw) {
        await waitAsync(delayActionSheetDrawTime / 2);
      }
      this._openAnimation(scrollOffset);
      this.underlayScale.setValue(1);
      this.underlayTranslateY.setValue(100);
      if (!gestureEnabled) {
        DeviceEventEmitter.emit("hasReachedTop");
      }
      this.layoutHasCalled = true;
    }
  };

  _openAnimation = (scrollOffset) => {
    let { bounciness, bounceOnOpen, animated, openAnimationSpeed } = this.props;

    if (animated) {
      this.transformValue.setValue(scrollOffset);
      Animated.parallel([
        Animated.spring(this.transformValue, {
          toValue: 0,
          bounciness: bounceOnOpen ? bounciness : 1,
          speed: openAnimationSpeed,
          useNativeDriver: true,
        }),
        Animated.timing(this.opacityValue, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      this.opacityValue.setValue(1);
    }
  };

  _onScrollBegin = async (event) => {};
  _onScrollBeginDrag = async (event) => {
    let verticalOffset = event.nativeEvent.contentOffset.y;
    this.prevScroll = verticalOffset;
  };

  _applyHeightLimiter() {
    if (this.actionSheetHeight > this.state.deviceHeight) {
      this.actionSheetHeight =
        (this.actionSheetHeight -
          (this.actionSheetHeight - this.state.deviceHeight)) *
        1;
    }
  }

  _onScrollEnd = async (event) => {
    let { springOffset, extraScroll } = this.props;
    let verticalOffset = event.nativeEvent.contentOffset.y;

    let correction = this.state.deviceHeight * 0.1;
    let distanceFromTop = this.actionSheetHeight + correction - this.offsetY;
    this._showHideTopUnderlay(distanceFromTop);

    if (this.isRecoiling) {
      this.isRecoiling = false;
      return;
    }

    if (this.prevScroll < verticalOffset) {
      if (verticalOffset - this.prevScroll > springOffset * 0.75) {
        this.isRecoiling = true;

        this._applyHeightLimiter();
        let correction = this.state.deviceHeight * 0.1;
        let scrollValue = this.actionSheetHeight + correction + extraScroll;

        this._scrollTo(scrollValue);
        this.currentOffsetFromBottom = 1;
        DeviceEventEmitter.emit("hasReachedTop", true);
      } else {
        this._returnToPrevScrollPosition(this.actionSheetHeight);
      }
    } else {
      if (this.prevScroll - verticalOffset > springOffset) {
        let scrollOffset = this.getInitialScrollPosition();
        if (this.props.isOverlay && verticalOffset > scrollOffset - 100) {
          this.isRecoiling = true;
          this._scrollTo(scrollOffset);
          this.currentOffsetFromBottom = this.props.initialOffsetFromBottom;
          this.prevScroll = scrollOffset;
        } else {
          this._hideModal();
        }
      } else {
        this.isRecoiling = true;
        this._returnToPrevScrollPosition(this.actionSheetHeight);
      }
    }
  };

  _returnToPrevScrollPosition(height) {
    let offset =
      height * this.currentOffsetFromBottom +
      this.state.deviceHeight * 0.1 +
      this.props.extraScroll;
    this._scrollTo(offset);
  }

  _scrollTo = (y, animated = true) => {
    this.scrollAnimationEndValue = y;
    this.prevScroll = y;
    this.scrollViewRef.current?._listRef._scrollRef.scrollTo({
      x: 0,
      y: this.scrollAnimationEndValue,
      animated: animated,
    });
  };

  _onTouchMove = () => {
    if (this.props.closeOnTouchBackdrop) {
      this._hideModal();
    }
    this.setState({
      scrollable: false,
    });
  };

  _onTouchStart = () => {
    if (this.props.closeOnTouchBackdrop) {
      this._hideModal();
    }
    this.setState({
      scrollable: false,
    });
  };

  _onTouchEnd = () => {
    if (this.props.gestureEnabled) {
      this.setState({
        scrollable: true,
      });
    }
  };

  getTarget = () => {
    return this.targetId;
  };

  _showHideTopUnderlay(distanceFromTop) {
    if (this.props.hideUnderlay) return;
    let diff =
      this.actionSheetHeight > this.state.deviceHeight
        ? this.actionSheetHeight - this.state.deviceHeight
        : this.state.deviceHeight - this.actionSheetHeight;
    if (diff < 1) {
      this.underlayTranslateY.setValue(-(100 - distanceFromTop));
      this.underlayScale.setValue(1 + (100 - distanceFromTop) / 100);
    } else {
      this.underlayTranslateY.setValue(100);
      this.underlayScale.setValue(1);
    }
  }

  _onScroll = (event) => {
    this.targetId = event.nativeEvent.target;
    this.offsetY = event.nativeEvent.contentOffset.y;

    let correction = this.state.deviceHeight * 0.1;
    let distanceFromTop = this.actionSheetHeight + correction - this.offsetY;

    if (distanceFromTop < 50) {
      this._showHideTopUnderlay(distanceFromTop);
      DeviceEventEmitter.emit("hasReachedTop", true);
    } else {
      if (distanceFromTop < 300) {
        this._showHideTopUnderlay(distanceFromTop);
      }

      DeviceEventEmitter.emit("hasReachedTop", false);
    }
  };

  _onRequestClose = () => {
    if (this.props.closeOnPressBack) this._hideModal();
  };

  _onTouchBackdrop = () => {
    if (this.props.closeOnTouchBackdrop) {
      this._hideModal();
    }
  };

  componentDidMount() {
    Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow",
      this._onKeyboardShow
    );

    Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidHide" : "keyboardWillHide",
      this._onKeyboardHide
    );
  }

  _onKeyboardShow = () => {
    this.setState({
      keyboard: true,
    });
  };

  /**
   * Attach this to any child ScrollView Component's onScrollEndDrag,
   * onMomentumScrollEnd,onScrollAnimationEnd callbacks to handle the ActionSheet
   * closing and bouncing back properly.
   */

  handleChildScrollEnd = async () => {
    if (this.offsetY > this.prevScroll) return;
    if (this.prevScroll - this.props.springOffset > this.offsetY) {
      let scrollOffset = this.getInitialScrollPosition();
      if (this.props.isOverlay && this.offsetY > scrollOffset - 100) {
        this.isRecoiling = true;
        this._scrollTo(scrollOffset);
        this.currentOffsetFromBottom = this.props.initialOffsetFromBottom;
        this.prevScroll = scrollOffset;
      } else {
        this._hideModal();
      }
    } else {
      this.isRecoiling = true;
      this._scrollTo(this.prevScroll, true);
    }
  };

  _onKeyboardHide = () => {
    this.setState({
      keyboard: false,
    });

    this._returnToPrevScrollPosition(this.actionSheetHeight);
    if (this.state.modalVisible) {
      this.opacityValue.setValue(1);
    }
  };

  componentWillUnmount() {
    Keyboard.removeListener(
      Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow",
      this._onKeyboardShow
    );

    Keyboard.removeListener(
      Platform.OS === "android" ? "keyboardDidHide" : "keyboardWillHide",
      this._onKeyboardHide
    );
  }

  _onDeviceLayout = (e) => {
    if (this.layoutTime) {
      clearTimeout(this.layoutTime);
      this.layoutTime = null;
    }
    let event = {...e}
    this.layoutTime = setTimeout(() => {
      let topSafeAreaPadding = (safeareaHeight - innerViewHeight) / 2;
      let height = event.nativeEvent.layout.height;
      if (Platform.OS === "ios") {
        height = height - topSafeAreaPadding;
      }
  
      let width = event.nativeEvent.layout.width;
  
      this._showHideTopUnderlay(
        this.actionSheetHeight * this.currentOffsetFromBottom
      );
    
      let emitHeight = () => {
        DeviceEventEmitter.emit(HEIGHT_CHANGE_EVENT, height);
      };
  
      if (
        height?.toFixed(0) === calculatedDeviceHeight?.toFixed(0) &&
        width?.toFixed(0) === this.state.deviceWidth?.toFixed(0)
      ) {
        if (!this.layoutHasCalled) {
          emitHeight();
        }
        return;
      }
  
      let prevHeight = calculatedDeviceHeight;
      calculatedDeviceHeight = height;
    
      let updateHeight = () => {
        this.setState({
          deviceHeight: height,
          deviceWidth: width,
          portrait: height > width,
        });
      };
  
      if (prevHeight < calculatedDeviceHeight || !this.layoutHasCalled) {
        updateHeight();
      } else {
        emitHeight();
      }
      waitAsync(prevHeight > calculatedDeviceHeight ? 5 : 0).then(() => {
        if (prevHeight > calculatedDeviceHeight) {
          updateHeight();
        } else {
          emitHeight();
        }
      });
    },20)
   
  };

  _getSafeAreaHeight = (event) => {
    safeareaHeight = event.nativeEvent.layout.height;
    this._getSafeAreaChildHeight({
      nativeEvent: {
        layout: {
          height: innerViewHeight,
          width: event.nativeEvent.layout.width,
          init: true,
        },
      },
    });
  };

  _getSafeAreaChildHeight = (event) => {
    innerViewHeight = event.nativeEvent.layout.height;
    event.nativeEvent.layout.height = safeareaHeight;
    if (!event.nativeEvent.layout.init && Platform.OS !== "ios") return;
    this._onDeviceLayout(event);
  };

  /**
   * ** OVERLAY MODE ONLY **
   * Whenever the user touches outside the ActionSheet,
   * scroll should be disabled.
   */
  onMoveResponder = (event) => {
    let ly = event.nativeEvent.locationY;
    let py = event.nativeEvent.pageY;
    if (!this.props.isOverlay || ly < py) return;
    let scroll = ly < this.state.deviceHeight * 1.1;
    this.scrollViewRef.current?.setNativeProps({
      scrollEnabled: !scroll,
    });
  };

  /**
   * ** OVERLAY MODE ONLY **
   * Whenever the user touches the ActionSheet,
   * scroll should be enabled.
   */
  onSheetMoveResponder = () => {
    this.scrollViewRef.current?.setNativeProps({
      scrollEnabled: true,
    });
  };

  /**
   * Calculate position of initial scroll.
   */
  getInitialScrollPosition() {
    this._applyHeightLimiter();
    let correction = this.state.deviceHeight * 0.1;
    return this.props.gestureEnabled
      ? this.actionSheetHeight * this.props.initialOffsetFromBottom +
          correction +
          this.props.extraScroll
      : this.actionSheetHeight + correction + this.props.extraScroll;
  }

 

  renderComponent = () => {
    let { scrollable, keyboard } = this.state;
    let {
      isOverlay,
      overlayColor,
      gestureEnabled,
      elevation,
      indicatorColor,
      defaultOverlayOpacity,
      children,
      containerStyle,
      CustomHeaderComponent,
      headerAlwaysVisible,
      keyboardShouldPersistTaps,
      hideUnderlay,
    } = this.props;

    let pointerEventsBox = isOverlay ? "box-none" : "auto";
    let pointerEventsNone = isOverlay ? "none" : "auto";

    return (
      <Animated.View
        onLayout={this._getSafeAreaHeight}
        style={[
          styles.parentContainer,
          {
            opacity: this.opacityValue,
            width: "100%",
          },
        ]}
        pointerEvents={pointerEventsBox}
      >
        <SafeAreaView
          onLayout={this._getSafeAreaHeight}
          style={styles.safeArea}
          pointerEvents={pointerEventsNone}
        >
          <View
            onLayout={this._getSafeAreaChildHeight}
            style={styles.safeAreaChild}
          />
        </SafeAreaView>
        

        <FlatList
          bounces={false}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          ref={this.scrollViewRef}
          scrollEventThrottle={5}
          showsVerticalScrollIndicator={false}
          onMomentumScrollBegin={this._onScrollBegin}
          onMomentumScrollEnd={this._onScrollEnd}
          scrollEnabled={scrollable && !keyboard}
          onScrollBeginDrag={this._onScrollBeginDrag}
          onScrollEndDrag={this._onScrollEnd}
          onTouchEnd={this._onTouchEnd}
          onScroll={this._onScroll}
          style={styles.scrollView}
          contentContainerStyle={{
            width: this.state.deviceWidth,
            backgroundColor:'transparent'
          }}
          onMoveShouldSetResponder={this.onMoveResponder}
          pointerEvents={Platform.OS === "ios" ? pointerEventsBox : pointerEventsNone}
          data={["dummy"]}
          keyExtractor={(item) => item}
          renderItem={({ item, index }) => (
            <View
              style={{
                width: "100%",
              }}
              pointerEvents={pointerEventsBox}
            >
              {!isOverlay && (
                <Animated.View
                  onTouchStart={this._onTouchBackdrop}
                  onTouchMove={this._onTouchBackdrop}
                  onTouchEnd={this._onTouchBackdrop}
                  style={{
                    height: "100%",
                    width: "100%",
                    position: "absolute",
                    zIndex: 1,
                    backgroundColor: overlayColor,
                    opacity: defaultOverlayOpacity,
                  }}
                />
              )}

             <BlankFiller />
            

              <Animated.View
                onLayout={this._showModal}
                ref={this.viewB}
                onMoveShouldSetResponder={this.onSheetMoveResponder}
                style={[
                  styles.container,
                  {
                    borderRadius: 10,
                  },
                  containerStyle,
                  {
                    ...getElevation(elevation),
                    zIndex: 11,
                    opacity: this.opacityValue,
                    transform: [
                      {
                        translateY: this.transformValue,
                      },
                    ],
                    maxHeight: this.state.deviceHeight,
                  },
                ]}
              >
                {!hideUnderlay && (
                  <Animated.View
                    ref={this.viewA}
                    style={{
                      position: "absolute",
                      top: 0,
                      width: "100%",
                      height: this.state.deviceHeight / 1.5,
                      backgroundColor:
                        containerStyle?.backgroundColor || "white",
                      borderRadius: containerStyle?.borderRadius || 10,
                      borderTopLeftRadius:
                        containerStyle?.borderTopLeftRadius || 10,
                      borderTopRightRadius:
                        containerStyle?.borderTopRightRadius || 10,
                      transform: [
                        {
                          translateY: this.underlayTranslateY,
                        },
                        {
                          scaleX: this.underlayScale,
                        },
                      ],
                    }}
                  />
                )}
                {gestureEnabled || headerAlwaysVisible ? (
                  CustomHeaderComponent ? (
                    CustomHeaderComponent
                  ) : (
                    <View
                      style={[
                        styles.indicator,
                        { backgroundColor: indicatorColor },
                      ]}
                    />
                  )
                ) : null}

                {children}
              </Animated.View>
            </View>
          )}
        />
      </Animated.View>
    );
  };

  render() {
    let { modalVisible } = this.state;
    let { isOverlay, testID, onOpen, statusBarTranslucent } = this.props;

    return !isOverlay ? (
      <Modal
        visible={modalVisible}
        animationType="none"
        testID={testID}
        supportedOrientations={SUPPORTED_ORIENTATIONS}
        onShow={onOpen}
        onRequestClose={this._onRequestClose}
        transparent={true}
        statusBarTranslucent={statusBarTranslucent}
      >
        <KeyboardAvoidingView style={styles.keyboardView} behavior="height">
          {this.renderComponent()}
        </KeyboardAvoidingView>
      </Modal>
    ) : !modalVisible ? null : (
      <View style={styles.overlayContainer} pointerEvents="box-none">
        {this.renderComponent()}
      </View>
    );
  }
}

ActionSheet.defaultProps = {
  testID: "actionSheetTest",
  children: <View />,
  CustomHeaderComponent: null,
  headerAlwaysVisible: false,
  containerStyle: {},
  animated: true,
  closeOnPressBack: true,
  gestureEnabled: false,
  bounceOnOpen: false,
  bounciness: 8,
  extraScroll: 0,
  hideUnderlay: false,
  closeAnimationDuration: 300,
  delayActionSheetDraw: false,
  delayActionSheetDrawTime: 50,
  openAnimationSpeed: 12,
  springOffset: 100,
  elevation: 5,
  initialOffsetFromBottom: 1,
  indicatorColor: "#f0f0f0",
  defaultOverlayOpacity: 0.3,
  overlayColor: "black",
  closable: true,
  bottomOffset: 0,
  closeOnTouchBackdrop: true,
  onClose: () => {},
  onOpen: () => {},
  keyboardShouldPersistTaps: "never",
  statusBarTranslucent: true,
  isOverlay: false,
};
ActionSheet.propTypes = {
  testID: PropTypes.string,
  children: PropTypes.node,
  CustomHeaderComponent: PropTypes.node,
  extraScroll: PropTypes.number,
  headerAlwaysVisible: PropTypes.bool,
  containerStyle: ViewPropTypes.style,
  animated: PropTypes.bool,
  hideUnderlay: PropTypes.bool,
  closeOnPressBack: PropTypes.bool,
  delayActionSheetDraw: PropTypes.bool,
  delayActionSheetDrawTime: PropTypes.number,
  gestureEnabled: PropTypes.bool,
  closeOnTouchBackdrop: PropTypes.bool,
  bounceOnOpen: PropTypes.bool,
  bounciness: PropTypes.number,
  springOffset: PropTypes.number,
  defaultOverlayOpacity: PropTypes.number,
  closeAnimationDuration: PropTypes.number,
  openAnimationSpeed: PropTypes.number,
  elevation: PropTypes.number,
  initialOffsetFromBottom: PropTypes.number,
  indicatorColor: PropTypes.string,
  closable: PropTypes.bool,
  bottomOffset: PropTypes.number,
  overlayColor: PropTypes.string,
  onClose: PropTypes.func,
  onOpen: PropTypes.func,
  keyboardShouldPersistTaps: PropTypes.oneOf(["always", "default", "never"]),
  statusBarTranslucent: PropTypes.bool,
  isOverlay: PropTypes.bool,
};
