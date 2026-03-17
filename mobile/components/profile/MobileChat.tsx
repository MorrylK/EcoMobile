/* eslint-disable react-hooks/exhaustive-deps */
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getGlobalStyles } from '@/styles/globalStyles';
import { haptics } from '@/utils/haptics';
import { ArrowLeft, Info, Paperclip, Send } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, TouchableOpacity, View, RefreshControl, Keyboard, TouchableWithoutFeedback, Animated, TextInput, TextInputContentSizeChangeEventData, NativeSyntheticEvent, Alert, Image } from 'react-native';
import { useMobileAuth } from '@/lib/mobile-auth';
import { useMobileI18n } from '@/lib/mobile-i18n';
import { chatService, ChatMessage } from '@/services/chatService';

interface MobileChatProps {
  onNavigate: (screen: string) => void;
}

export function MobileChat({ onNavigate }: MobileChatProps) {
  const { t, language } = useMobileI18n();
  const { user } = useMobileAuth();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const inputContainerAnim = useRef(new Animated.Value(0)).current;
  const [inputHeight, setInputHeight] = useState(40);

  useEffect(() => {
    loadMessages();
    
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        Animated.timing(inputContainerAnim, {
          toValue: -e.endCoordinates.height,
          duration: 250,
          useNativeDriver: true,
        }).start();
        
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        Animated.timing(inputContainerAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isTyping]);

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const result = await chatService.getMessages(1, 100);
      setMessages(result.messages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttachment = async () => {
    haptics.light();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('chat.permissionRequired') || 'Permission requise', t('chat.galleryPermission') || 'Autorisez l\'accès à la galerie pour envoyer des images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const base64DataUri = `data:${mimeType};base64,${asset.base64}`;
    setIsSending(true);
    try {
      const { url } = await chatService.uploadAttachment(base64DataUri);
      const sentMessage = await chatService.sendMessage(`[image]${url}`);
      setMessages(prev => [...prev, sentMessage]);
    } catch {
      Alert.alert(t('common.error') || 'Erreur', t('chat.uploadError') || 'Impossible d\'envoyer l\'image.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    haptics.light();
    setIsSending(true);
    
    const messageContent = newMessage;
    setNewMessage('');
    setInputHeight(40);
    Keyboard.dismiss();

    try {
      const sentMessage = await chatService.sendMessage(messageContent);
      setMessages(prev => [...prev, sentMessage]);
      
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const supportMessage: ChatMessage = {
          id: Date.now().toString(),
          userId: 'support-admin',
          message: t('chat.autoResponse'),
          isAdmin: true,
          createdAt: new Date().toISOString(),
          user: {
            id: 'support-admin',
            firstName: t('chat.support'),
            lastName: 'FreeBike',
            role: 'admin'
          }
        };
        setMessages(prev => [...prev, supportMessage]);
      }, 2000);
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const time = new Date(timestamp);
    return time.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleContentSizeChange = (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    const { contentSize } = event.nativeEvent;
    const newHeight = Math.max(40, Math.min(100, contentSize.height));
    setInputHeight(newHeight);
  };

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'light' ? 'white' : '#111827' }]}>
      {/* Header */}
      <View 
        style={[
          styles.row,
          styles.alignCenter,
          styles.gap12,
          styles.p16,
          styles.shadowLg,
          { 
            backgroundColor: colorScheme === 'light' ? 'white' : '#1f2937',
            borderBottomWidth: 1,
            borderBottomColor: colorScheme === 'light' ? '#e5e7eb' : '#374151',
            zIndex: 10,
          }
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            onNavigate('profile');
          }}
          style={[styles.p8, styles.rounded8]}
        >
          <ArrowLeft size={20} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
        </TouchableOpacity>
        
        <View style={[styles.row, styles.alignCenter, styles.gap12, styles.flex1]}>
          <View style={styles.relative}>
            <View 
              style={[
                styles.w40,
                styles.h40,
                styles.rounded20,
                styles.alignCenter,
                styles.justifyCenter,
                { backgroundColor: '#16a34a' }
              ]}
            >
              <Text size="sm" color="white" weight="medium">S</Text>
            </View>
            <View 
              style={[
                styles.absolute,
                { bottom: 0, right: 0 },
                styles.w12,
                styles.h12,
                { borderRadius: 6 },
                { backgroundColor: '#10b981', borderWidth: 2, borderColor: 'white' }
              ]}
            />
          </View>
          
          <View style={styles.flex1}>
            <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
              {t('chat.support')}
            </Text>
            <Text size="xs" color="#10b981">
              {t('chat.online')}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.p8, styles.rounded8]}
          onPress={() => {
            haptics.light();
          }}
        >
          <Info size={20} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
        </TouchableOpacity>
      </View>

      {/* Messages Container */}
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <View style={styles.flex1}>
          <ScrollView 
            ref={scrollViewRef}
            style={styles.flex1}
            contentContainerStyle={[styles.p16, styles.gap12, { paddingBottom: 8 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={loadMessages}
                colors={['#16a34a']}
                tintColor="#16a34a"
              />
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Info Banner */}
            <View 
              style={[
                styles.p12,
                styles.rounded8,
                styles.alignCenter,
                styles.mb16,
                { 
                  backgroundColor: colorScheme === 'light' ? '#f0fdf4' : '#14532d', 
                  borderWidth: 1,
                  borderColor: '#16a34a'
                }
              ]}
            >
              <Text size="xs" color="#16a34a" style={styles.textCenter}>
                {t('chat.secureNotice')}
              </Text>
            </View>

            {/* Messages */}
            {messages.map((message, index) => {
              const isCurrentUser = !message.isAdmin;
              const showDate = index === 0 || 
                new Date(messages[index - 1].createdAt).toDateString() !== new Date(message.createdAt).toDateString();

              return (
                <View key={message.id}>
                  {/* Date separator */}
                  {showDate && (
                    <View style={[styles.alignCenter, styles.my16]}>
                      <View 
                        style={[
                          styles.px12,
                          styles.py4,
                          styles.rounded16,
                          { backgroundColor: colorScheme === 'light' ? '#e5e7eb' : '#4b5563' }
                        ]}
                      >
                        <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
                          {new Date(message.createdAt).toLocaleDateString(
                            language === 'fr' ? 'fr-FR' : 'en-US',
                            { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
                          )}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Message */}
                  <View style={[styles.mb12]}>
                    <View
                      style={[
                        styles.row,
                        styles.gap8,
                        isCurrentUser ? styles.justifyEnd : styles.justifyStart,
                        { alignItems: 'flex-end' }
                      ]}
                    >
                      {!isCurrentUser && (
                        <View 
                          style={[
                            styles.w32,
                            styles.h32,
                            styles.rounded16,
                            styles.alignCenter,
                            styles.justifyCenter,
                            styles.shadow,
                            { backgroundColor: '#16a34a' }
                          ]}
                        >
                          <Text size="xs" color="white" weight="medium">A</Text>
                        </View>
                      )}

                      <View style={[{ maxWidth: '70%' }]}>
                        <View
                          style={[
                            styles.px16,
                            styles.py12,
                            { borderRadius: 20 },
                            isCurrentUser
                              ? { 
                                  backgroundColor: '#16a34a', 
                                  borderBottomRightRadius: 8
                                }
                              : { 
                                  backgroundColor: colorScheme === 'light' ? 'white' : '#374151',
                                  borderWidth: 1,
                                  borderColor: colorScheme === 'light' ? '#e5e7eb' : '#4b5563',
                                  borderBottomLeftRadius: 8
                                }
                          ]}
                        >
                          {message.message.startsWith('[image]') ? (
                            <Image
                              source={{ uri: message.message.replace('[image]', '') }}
                              style={{ width: 200, height: 150, borderRadius: 8 }}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text
                              size="sm"
                              color={isCurrentUser ? 'white' : (colorScheme === 'light' ? '#111827' : '#f9fafb')}
                            >
                              {message.message}
                            </Text>
                          )}
                        </View>
                        <Text 
                          size="xs" 
                          color={colorScheme === 'light' ? '#9ca3af' : '#6b7280'} 
                          style={[
                            styles.mt4,
                            isCurrentUser ? styles.textRight : styles.textLeft,
                            { paddingHorizontal: 8 }
                          ]}
                        >
                          {formatTime(message.createdAt)}
                        </Text>
                      </View>

                      {isCurrentUser && (
                        <View 
                          style={[
                            styles.w32,
                            styles.h32,
                            styles.rounded16,
                            styles.alignCenter,
                            styles.justifyCenter,
                            styles.shadow,
                            { backgroundColor: colorScheme === 'light' ? '#4b5563' : '#6b7280' }
                          ]}
                        >
                          <Text size="xs" color="white" weight="medium">
                            {user?.firstName?.[0]}{user?.lastName?.[0]}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Typing indicator */}
            {isTyping && (
              <View style={[styles.row, styles.gap8, styles.mb12]}>
                <View 
                  style={[
                    styles.w32,
                    styles.h32,
                    styles.rounded16,
                    styles.alignCenter,
                    styles.justifyCenter,
                    styles.shadow,
                    { backgroundColor: '#16a34a' }
                  ]}
                >
                  <Text size="xs" color="white" weight="medium">S</Text>
                </View>
                <View style={[{ maxWidth: '70%' }]}>
                  <View
                    style={[
                      styles.px16,
                      styles.py12,
                      { borderRadius: 20, borderBottomLeftRadius: 8 },
                      { 
                        backgroundColor: colorScheme === 'light' ? 'white' : '#374151',
                        borderWidth: 1,
                        borderColor: colorScheme === 'light' ? '#e5e7eb' : '#4b5563'
                      }
                    ]}
                  >
                    <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                      <View 
                        style={[
                          styles.w8,
                          styles.h8,
                          { borderRadius: 4 },
                          { backgroundColor: colorScheme === 'light' ? '#9ca3af' : '#6b7280' }
                        ]}
                      />
                      <View 
                        style={[
                          styles.w8,
                          styles.h8,
                          { borderRadius: 4 },
                          { backgroundColor: colorScheme === 'light' ? '#9ca3af' : '#6b7280' }
                        ]}
                      />
                      <View 
                        style={[
                          styles.w8,
                          styles.h8,
                          { borderRadius: 4 },
                          { backgroundColor: colorScheme === 'light' ? '#9ca3af' : '#6b7280' }
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}
            
            {/* Spacer for keyboard */}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* Message Input - Animated */}
      <Animated.View 
        style={[
          styles.p16,
          styles.shadowLg,
          { 
            backgroundColor: colorScheme === 'light' ? 'white' : '#1f2937',
            borderTopWidth: 1,
            borderTopColor: colorScheme === 'light' ? '#e5e7eb' : '#374151',
            transform: [{ translateY: inputContainerAnim }]
          }
        ]}
      >
        <View style={[styles.row, styles.alignCenter, styles.gap8, { alignItems: 'flex-end' }]}>
          <TouchableOpacity
            style={[styles.p12, styles.rounded8, { marginBottom: 8 }]}
            onPress={handleAttachment}
            disabled={isSending}
          >
            <Paperclip size={20} color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} />
          </TouchableOpacity>
          
          <View style={[styles.flex1, { minHeight: 40 }]}>
            <TextInput
              ref={inputRef}
              placeholder={t('chat.messagePlaceholder')}
              placeholderTextColor={colorScheme === 'light' ? '#9ca3af' : '#6b7280'}
              value={newMessage}
              onChangeText={setNewMessage}
              editable={!isSending}
              multiline
              maxLength={500}
              style={[
                {
                  backgroundColor: colorScheme === 'light' ? '#f9fafb' : '#374151',
                  borderWidth: 1,
                  borderColor: colorScheme === 'light' ? '#e5e7eb' : '#4b5563',
                  borderRadius: 5,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  color: colorScheme === 'light' ? '#111827' : '#f9fafb',
                  fontSize: 16,
                  textAlignVertical: 'center',
                  minHeight: 40,
                  maxHeight: 100,
                },
                { height: inputHeight }
              ]}
              onContentSizeChange={handleContentSizeChange}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
            />
          </View>
          
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
            style={[
              styles.p12,
              styles.rounded8,
              { 
                backgroundColor: (newMessage.trim() && !isSending) ? '#16a34a' : (colorScheme === 'light' ? '#d1d5db' : '#4b5563'),
                opacity: (newMessage.trim() && !isSending) ? 1 : 0.6,
                marginBottom: 8
              }
            ]}
          >
            <Send size={16} color="white" />
          </TouchableOpacity>
        </View>
        <Text size="xs" color={colorScheme === 'light' ? '#9ca3af' : '#6b7280'} style={[styles.mt8, styles.textCenter]}>
          {t('chat.averageResponse')}
        </Text>
      </Animated.View>
    </View>
  );
}