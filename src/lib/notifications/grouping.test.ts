import { describe, expect, it } from "vitest";
import { groupNotifications } from "./grouping";
import type { Notification } from "@/hooks/useNotifications";
const notice = (id: string, type: Notification['type'], content = 'tv-1', date = '2026-10-07T12:00:00Z'): Notification => ({ id, type, related_content_id: content, created_at: date, user_id: 'owner', title: 'Aviso', message: null, related_user_id: id, is_read: false });
describe('notification grouping', () => {
 it('groups likes of the same activity and day', () => {
  expect(groupNotifications([notice('a','activity_like'),notice('b','activity_like')],'all')[0].items).toHaveLength(2);
 });
 it('keeps comments and distinct activities separate', () => {
  expect(groupNotifications([notice('a','activity_comment'),notice('b','activity_comment'),notice('c','activity_like','other')],'all')).toHaveLength(3);
 });
 it('never mixes subscription, rental and purchase', () => {
  expect(groupNotifications([notice('a','streaming_change'),notice('b','rental_arrival'),notice('c','purchase_arrival')],'content')).toHaveLength(3);
 });
 it('filters by the user need, without losing social events', () => {
  const items=[notice('a','streaming_change'),notice('b','friend_request')];
  expect(groupNotifications(items,'social').map(g=>g.items[0].id)).toEqual(['b']);
  expect(groupNotifications(items,'content').map(g=>g.items[0].id)).toEqual(['a']);
 });
 it('keeps separate days separate', () => {
  expect(groupNotifications([notice('a','activity_like'),notice('b','activity_like','tv-1','2026-10-06T12:00:00Z')],'all')).toHaveLength(2);
 });
});
