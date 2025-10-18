import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

const API_PROFILE = 'https://functions.poehali.dev/08cca8cc-c006-450f-adcb-24ef706d1545';

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  status?: string;
}

interface ProfileEditProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  token: string;
  onUpdate: (user: User) => void;
}

export const ProfileEdit = ({ open, onOpenChange, user, token, onUpdate }: ProfileEditProps) => {
  const [formData, setFormData] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    status: user.status || '',
    avatar_url: user.avatar_url || '',
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(API_PROFILE, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token,
        },
        body: JSON.stringify({
          action: 'update_profile',
          ...formData,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        onUpdate(data);
        localStorage.setItem('vnechat_user', JSON.stringify(data));
        toast({ title: 'Успешно', description: 'Профиль обновлён' });
        onOpenChange(false);
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось обновить профиль', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    return `${formData.first_name?.[0] || ''}${formData.last_name?.[0] || ''}`.toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Редактировать профиль</DialogTitle>
          <DialogDescription>Измените свою информацию</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="w-24 h-24">
              <AvatarImage src={formData.avatar_url} />
              <AvatarFallback className="bg-primary text-white text-2xl">{getInitials()}</AvatarFallback>
            </Avatar>
            <div className="w-full space-y-2">
              <Label htmlFor="avatar_url">URL аватара</Label>
              <Input
                id="avatar_url"
                placeholder="https://example.com/avatar.jpg"
                value={formData.avatar_url}
                onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Вставьте ссылку на изображение</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Имя *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Фамилия *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Статус</Label>
            <Textarea
              id="status"
              placeholder="Ваш статус..."
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Имя пользователя</Label>
            <Input value={user.username} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">Имя пользователя нельзя изменить</p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
