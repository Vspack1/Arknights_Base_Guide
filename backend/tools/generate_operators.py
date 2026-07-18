"""
generate_operators.py

Tải building_data.json + character_table.json từ Dimbreath/ArknightsData (en-US)
và sinh ra backend/data/operators.json theo đúng schema app đang dùng.

CHẠY LẠI KHI NÀO?
- Khi muốn refresh lại data (lưu ý: repo Dimbreath/ArknightsData đã archived, ngừng cập nhật,
  nên chạy lại sẽ ra kết quả giống hệt — không có operator mới).
- Nếu tìm được nguồn en-US khác đang active (ví dụ ArknightsGameData_YoStar khi nào họ
  fix xong cấu trúc thư mục), chỉ cần đổi 2 biến URL bên dưới.

CÁCH DÙNG:
    pip install requests
    python3 generate_operators.py

COMBO_TAGS:
  Việc gán combo_tags cho từng skill là THỦ CÔNG (đọc mô tả effect thật rồi tự quyết định
  operator nào thuộc combo nào) — script này chỉ tự động phần lấy dữ liệu thô (tên, rarity,
  profession, mô tả skill, room, elite yêu cầu). Muốn thêm operator mới vào 1 combo, sửa
  dict COMBO_TAGS bên dưới rồi chạy lại, hoặc sửa trực tiếp operators.json + combos.json.
"""
import json
import re
import requests

BUILDING_URL = "https://raw.githubusercontent.com/Dimbreath/ArknightsData/master/en-US/gamedata/excel/building_data.json"
CHARACTER_URL = "https://raw.githubusercontent.com/Dimbreath/ArknightsData/master/en-US/gamedata/excel/character_table.json"

PROF_MAP = {
    'PIONEER': 'Vanguard', 'WARRIOR': 'Guard', 'TANK': 'Defender',
    'SNIPER': 'Sniper', 'CASTER': 'Caster', 'SUPPORT': 'Supporter',
    'MEDIC': 'Medic', 'SPECIAL': 'Specialist', 'TOKEN': 'Token', 'TRAP': 'Trap'
}
ROOM_MAP = {
    'MANUFACTURE': 'Factory', 'TRADING': 'TradingPost', 'POWER': 'PowerPlant',
    'DORMITORY': 'Dorm', 'MEETING': 'Reception', 'HIRE': 'Office',
    'TRAINING': 'TrainingRoom', 'WORKSHOP': 'Workshop', 'CONTROL': 'Control'
}

TAG_RE = re.compile(r'<[^>]*>')
def clean(text):
    if not text:
        return ''
    return TAG_RE.sub('', text).replace('\n', ' ').strip()

# Keyed by buffId (globally unique per skill -- some operators have two skills that
# share the same elite `phase`, e.g. Lancet-2's Power Plant skill and Dorm skill are
# both phase=0, so keying by (char_id, phase) is ambiguous. buffId is safe.
# Gán thủ công sau khi đọc kỹ mô tả effect thật. Xem README phần "Thêm operator mới
# vào database" để biết cách mở rộng.
COMBO_TAGS = {
    'trade_ord_spd&cost_P[000]': ['texas_lappland_pair'],          # Texas - Feud
    'manu_prod_limit&cost[0000]': ['vermeil_factory_core'],        # Vermeil - Junkman
    'manu_prod_spd_variable[000]': ['vermeil_factory_core'],       # Vermeil - Recycling
    'trade_ord_wt&cost[010]': ['bibeak_precious_metal'],           # Bibeak - Tailoring beta
    'manu_formula_spd[101]': ['gravel_precious_metal'],            # Gravel - Metalwork beta
    'trade_ord_vodfox[000]': ['shamare_solo_trading'],             # Shamare - Whispers
    'manu_prod_spd_addition[041]': ['scene_factory_ramp'],         # Scene - Time-Lapse Photography
    'manu_prod_limit&cost[010]': ['bubble_factory_capacity'],      # Bubble - Hoarder
    'manu_prod_spd_variable3[000]': ['bubble_factory_capacity'],   # Bubble - Bigger is Better!
    'power_rec_spd[011]': ['purestream_power_drone'],              # Purestream - Clean Energy
    'manu_prod_spd_variable2[000]': ['waaifu_factory_stack'],      # Waai Fu - Cooperative Will
    'trade_ord_limit_diff[000]': ['jaye_trading_swing'],           # Jaye - Street Economics
    'trade_ord_wt&cost[011]': ['kafka_precious_metal'],            # Kafka - Handicrafts beta
    'dorm_rec_all[012]': ['podenco_dorm_group'],                   # Podenco - Nourish the Soul
    'dorm_rec_single[000]': ['lancet2_dorm_filler'],                # Lancet-2 - Medical Service
    'manu_formula_spd[000]': ['castle3_factory_battlerecord'],     # Castle-3 - Combat Guidance Video
    'trade_ord_spd&limit[010]': ['orchid_trading_secondary'],      # Orchid - Supply Management
}


def main():
    building = requests.get(BUILDING_URL, timeout=30).json()
    character = requests.get(CHARACTER_URL, timeout=30).json()

    chars = building['chars']
    buffs = building['buffs']

    operators = []
    for cid, char in chars.items():
        info = character.get(cid)
        if not info:
            continue
        name = info.get('name', cid)
        rarity = info.get('rarity', 0) + 1
        profession = PROF_MAP.get(info.get('profession'), info.get('profession'))

        skills = []
        for entry in char.get('buffChar', []):
            for bdta in entry.get('buffData', []):
                bid = bdta['buffId']
                cond = bdta.get('cond', {})
                buff = buffs.get(bid)
                if not buff:
                    continue
                room = ROOM_MAP.get(buff.get('roomType', ''), buff.get('roomType', ''))
                phase = cond.get('phase', 0)
                level = cond.get('level', 1)
                tags = COMBO_TAGS.get(bid, [])
                skills.append({
                    'id': bid,
                    'name': buff.get('buffName', ''),
                    'room': room,
                    'elite_required': phase,
                    'level_required': level,
                    'effect': clean(buff.get('description', '')),
                    'combo_tags': tags
                })
        if skills:
            operators.append({
                'name': name,
                'char_id': cid,
                'rarity': rarity,
                'profession': profession,
                'skills': skills
            })

    operators.sort(key=lambda o: o['name'])

    out = {
        '_meta': {
            'note': ('Auto-generated from Dimbreath/ArknightsData (en-US, archived snapshot). '
                     'Covers operators released up to the archive date only -- newer operators '
                     '(e.g. Proviso, Tequila, Quartz, Pudding) are NOT included and must be added '
                     'manually. combo_tags are hand-curated only for operators referenced in '
                     'combos.json; most operators have empty combo_tags (raw data only).'),
            'source': 'https://github.com/Dimbreath/ArknightsData (archived)',
            'generated_by': 'backend/tools/generate_operators.py',
            'operator_count': len(operators)
        },
        'operators': operators
    }

    with open('../data/operators.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    print(f'Wrote {len(operators)} operators to ../data/operators.json')


if __name__ == '__main__':
    main()
