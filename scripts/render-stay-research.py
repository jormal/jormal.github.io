"""Render the research ledger and analysis; --check verifies without writing."""
import collections
import html
import json
import re
from pathlib import Path
import sys
from urllib.parse import quote_plus, urlsplit

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'temp/iberian-stay-source-summaries.json'
ARCHIVE = ROOT / 'temp/iberian-stay-research-archive.json'
PAGE = ROOT / 'temp/iberian-stay-social-research.html'
START = '    <!-- Verified research start -->'
END = '    <!-- Verified research end -->'
CITIES = ['Madrid', 'Porto', 'Lisbon', 'Sevilla', 'Granada', 'Barcelona']


def render(data, archive):
    sources = {s['id']: s for s in data['sources']}
    analysis = data['analysis']
    reviews = {r['id']: r for r in analysis['reviews']}
    comparison_details = analysis['comparison_details']
    hotel_areas = analysis['hotel_areas']
    city_context = analysis['city_context']
    area_verifications = analysis.get('area_verifications', [])
    maps_date_overrides = analysis.get('maps_date_overrides', {})
    maps_date_checks = analysis.get('maps_date_checks', [])
    review_search_attempts = analysis.get('review_search_attempts', [])
    legacy_documents = archive.get('legacy_documents', {})
    area_route_evidence = analysis.get('area_route_evidence', [])
    property_link_overrides = analysis.get('property_link_overrides', {})
    user_provided_candidates = data.get('user_provided_candidates', [])
    price_checks = data['price_checks']
    user_provided_hotels = {
        (item['city'], item['hotel']) for item in user_provided_candidates
        if item.get('city') and item.get('hotel')
    }
    user_candidate_by_property = {
        (item['city'], item['hotel']): item for item in user_provided_candidates
        if item.get('city') and item.get('hotel')
    }
    user_candidate_by_id = {item['id']: item for item in user_provided_candidates}
    assert len(sources) == len(data['sources']), 'Duplicate source ID'
    assert len({s['url'] for s in sources.values()}) == len(sources), 'Duplicate URL'
    assert len(reviews) == len(analysis['reviews']), 'Duplicate review ID'
    review_policy_archive = legacy_documents.get('reference-policy-2026-09-10', {})
    assert review_policy_archive.keys() >= {
        'purpose', 'format', 'policy_changed_at', 'exclusion_rule', 'retired_analysis_reviews',
    }, 'Review-policy archive missing'
    retired_reviews = review_policy_archive['retired_analysis_reviews']
    assert review_policy_archive['policy_changed_at'] == '2026-09-10'
    assert len({r['id'] for r in retired_reviews}) == len(retired_reviews), 'Duplicate archived review ID'
    assert not ({r['id'] for r in reviews.values()} & {r['id'] for r in retired_reviews}), 'Active and archived reviews overlap'
    assert len(area_verifications) == 44, 'Every reclassified price candidate needs one address-evidence record'
    assert len({(item['city'], item['hotel']) for item in area_verifications}) == len(area_verifications), 'Duplicate area evidence'
    assert all(
        item.keys() >= {'city', 'hotel', 'area', 'address', 'source_url', 'source_kind', 'verified_at'}
        and item['city'] in CITIES and item['hotel'] in analysis['hotel_areas'][item['city']]
        and item['area'] == analysis['hotel_areas'][item['city']][item['hotel']]
        and item['source_kind'] == 'official_or_public_lodging_address'
        and item['source_url'].startswith('https://') and item['verified_at'] == '2026-09-10'
        for item in area_verifications
    ), 'Invalid area-address evidence'
    assert len(area_route_evidence) == sum(len(context['area_notes']) for context in city_context.values()), 'Every displayed area needs route evidence'
    assert len({(item['city'], item['area']) for item in area_route_evidence}) == len(area_route_evidence), 'Duplicate area route evidence'
    assert all(
        item.keys() >= {'city', 'area', 'arrival', 'departure', 'tourism_basis'}
        and item['city'] in CITIES and item['area'] and item['tourism_basis']
        and item.get('tourism_source_url', '').startswith('https://')
        and all(
            leg.keys() >= {'mode', 'time_basis', 'planner', 'source_url', 'checked_at', 'result'}
            and leg['mode'] in {'taxi', 'transit', 'same_point', 'unavailable'}
            and leg['time_basis'] in {
                'vehicle_only', 'in_vehicle_only', 'in_vehicle_plus_walk',
                'in_vehicle_plus_transfer_walk', 'planner_total_including_walk_wait_transfer', 'no_transfer', 'unavailable',
            }
            and leg['planner'] and leg['result'] and leg['checked_at'] == '2026-09-10'
            and (leg['mode'] in {'unavailable', 'same_point'} or leg['source_url'].startswith('https://'))
            and (leg['mode'] != 'taxi' or leg['time_basis'] == 'vehicle_only')
            for leg in (item['arrival'], item['departure'])
        )
        for item in area_route_evidence
    ), 'Invalid area route evidence'
    assert len({(r['city'], r['source_id'], r['author'], r['property']) for r in reviews.values()}) == len(reviews), 'Duplicate experience'
    assert all(s['status'] in {'verified', 'metadata_only', 'unavailable'} for s in sources.values())
    assert all(s.get('summary') for s in sources.values() if s['status'] == 'verified')
    assert all(s.get('caveats') for s in sources.values() if s['status'] != 'verified')
    expected_user_provided_candidates = [
        ('UP01', 'Agoda', 'https://www.agoda.com/casa-miravalle-apartamentos-catedral/hotel/granada-es.html'),
        ('UP02', 'Agoda', 'https://www.agoda.com/smart-suites-albaicin/hotel/granada-es.html'),
        ('UP03', 'Airbnb', 'https://www.airbnb.co.kr/rooms/41856342'),
        ('UP04', 'Airbnb', 'https://www.airbnb.com/l/qGcpUrYz'),
        ('UP05', 'Airbnb', 'https://www.airbnb.co.kr/rooms/14164414'),
        ('UP06', 'Airbnb', 'https://www.airbnb.co.kr/rooms/1100259048686597204'),
        ('UP07', 'Airbnb', 'https://www.airbnb.co.kr/rooms/2237750'),
        ('UP08', 'Airbnb', 'https://www.airbnb.co.kr/rooms/1468185373402469674'),
        ('UP09', 'Airbnb', 'https://www.airbnb.co.kr/rooms/1110775765657684157'),
        ('UP10', 'Airbnb', 'https://www.airbnb.co.kr/rooms/817311161939596188'),
        ('UP11', 'Airbnb', 'https://www.airbnb.co.kr/rooms/886838723814651944'),
        ('UP12', 'Airbnb', 'https://www.airbnb.co.kr/rooms/980287760713400167'),
        ('UP13', 'Airbnb', 'https://www.airbnb.co.kr/rooms/1806117'),
    ]
    assert [(item.get('id'), item.get('platform'), item.get('canonical_url')) for item in user_provided_candidates] == expected_user_provided_candidates, 'User-provided candidate list must retain all 13 normalized links in order'
    assert all(
        item.keys() >= {'id', 'platform', 'candidate', 'canonical_url', 'status', 'result', 'placement'}
        and item['platform'] in {'Agoda', 'Airbnb'}
        and item['status'] in {'verified', 'metadata_only', 'unavailable'}
        and item['placement'] in {'not_cataloged', 'catalog_only', 'current_comparison'}
        and (not item.get('source_id') or item['source_id'] in sources)
        and (not item.get('city') or item['city'] in CITIES)
        and (not item.get('user_submission_count') or isinstance(item['user_submission_count'], int))
        and all(
            set(context) == {'check_in', 'check_out', 'occupancy', 'basis'}
            and re.fullmatch(r'2026-11-\d\d', context['check_in'])
            and re.fullmatch(r'2026-11-\d\d', context['check_out'])
            and context['occupancy'] == '성인 2명'
            for context in item.get('user_availability_contexts', [])
        )
        for item in user_provided_candidates
    ), 'Invalid user-provided property'
    assert price_checks.keys() >= {
        '_meta', 'as_of', 'currency', 'occupancy', 'taxes_and_fees',
        'cap_per_night_krw', 'user_provided_policy', 'updated_at', 'cities',
    }, 'Price-check contract missing'
    assert set(price_checks['cities']) == set(CITIES), 'Price-check cities missing'
    assert price_checks['as_of'] == '2026-09-09' and price_checks['currency'] == 'KRW'
    assert price_checks['occupancy'] == '성인 2명 · 객실 1개'
    assert price_checks['cap_per_night_krw'] == 299999
    assert 'UP01~UP13' in price_checks['user_provided_policy'], 'User-provided price exception missing'
    for city, check in price_checks['cities'].items():
        assert check.keys() >= {'check_in', 'check_out', 'google_hotels_url_template', 'prices'}, f'{city}: Price check missing'
        assert re.fullmatch(r'2026-11-\d\d', check['check_in']) and re.fullmatch(r'2026-11-\d\d', check['check_out'])
        assert '{query}' in check['google_hotels_url_template'] and 'google.com/travel/search' in check['google_hotels_url_template']
        assert len({item['hotel'] for item in check['prices']}) == len(check['prices']), f'{city}: Duplicate price hotel'
        assert all(
            item.keys() >= {'hotel', 'nightly_krw', 'stay_total_krw', 'checked_at'}
            and isinstance(item['nightly_krw'], int) and isinstance(item['stay_total_krw'], int)
            and item['nightly_krw'] > 0 and item['stay_total_krw'] >= item['nightly_krw']
            and item.get('listing_type', 'hotel') in {'hotel', 'non_hotel'}
            and re.fullmatch(r'2026-09-\d\d', item['checked_at'])
            and (not item.get('budget_focus') or isinstance(item['budget_focus'], bool))
            for item in check['prices']
        ), f'{city}: Invalid price item'
    comparison_hotels_by_city = {
        city: {hotel for row in analysis['comparisons'] if row['city'] == city for hotel in row['hotels']}
        for city in CITIES
    }
    assert len(maps_date_checks) == sum(map(len, comparison_hotels_by_city.values())), 'Maps date checks must cover every comparison hotel'
    assert len({(check['city'], check['hotel']) for check in maps_date_checks}) == len(maps_date_checks), 'Duplicate Maps date check'
    assert {(check['city'], check['hotel']) for check in maps_date_checks} == {
        (city, hotel) for city, hotels in comparison_hotels_by_city.items() for hotel in hotels
    }, 'Maps date checks missing comparison hotel'
    checks_by_hotel = {(check['city'], check['hotel']): check for check in maps_date_checks}
    assert all(
        check.keys() >= {'city', 'hotel', 'status', 'precheck_method', 'precheck_checked_at'}
        and check['city'] in CITIES
        and check['hotel'] in comparison_hotels_by_city[check['city']]
        and check['status'] in {'date_applied', 'direct_link', 'fallback'}
        and (check['status'] == 'fallback' or check['status'] == 'direct_link' or (
            (check['city'], check['hotel']) in {
                (override_city, override_hotel)
                for override_city, overrides in maps_date_overrides.items()
                for override_hotel in overrides
            }
        ))
        for check in maps_date_checks
    ), 'Maps final-link status must agree with an exact place-date override or direct source'
    for city, overrides in maps_date_overrides.items():
        assert city in CITIES and isinstance(overrides, dict), 'Invalid Maps date override city'
        for hotel, override in overrides.items():
            assert hotel in comparison_details[city], f'{city}: Maps date override is not a comparison hotel'
            assert override.keys() >= {'url', 'check_in', 'nights', 'verified_at', 'verification', 'precheck_title'}, f'{city}: Incomplete Maps date override'
            assert override['url'].startswith('https://www.google.com/maps/place/')
            url_dates = set(re.findall(r'2026-\d{2}-\d{2}', override['url']))
            assert url_dates == {override['check_in']}, f'{city}: Maps URL must contain only its city check-in date'
            assert '!4m1!1i2' in override['url'], f'{city}: Maps URL must retain adult-2 state'
            assert override['check_in'] == price_checks['cities'][city]['check_in'], f'{city}: Maps date does not match stay'
            assert isinstance(override['nights'], int) and override['nights'] == (
                int(price_checks['cities'][city]['check_out'][-2:]) - int(override['check_in'][-2:])
            ), f'{city}: Maps nights do not match stay'
            assert override['nights'] == 1 or f'!2i{override["nights"]}' in override['url'], f'{city}: Maps nights missing from override URL'
            check = checks_by_hotel[(city, hotel)]
            assert check['status'] == 'date_applied' and check['precheck_title'] == override['precheck_title'], f'{city}: Maps override without matching Chromium check'
    for city, overrides in property_link_overrides.items():
        assert city in CITIES and isinstance(overrides, dict), 'Invalid direct property-link override city'
        for hotel, override in overrides.items():
            assert hotel in comparison_details[city], f'{city}: Direct link override is not a comparison hotel'
            assert override.keys() >= {'url', 'label', 'link_type', 'verified_at', 'verification'}, f'{city}: Incomplete direct property-link override'
            assert override['link_type'] in {'airbnb', 'agoda'}, f'{city}: Invalid direct property-link type'
            source_id = override.get('source_id')
            candidate_id = override.get('user_candidate_id')
            assert bool(source_id) != bool(candidate_id), f'{city}: Direct link must have one authoritative source'
            if source_id:
                assert source_id in sources and override['url'] == sources[source_id]['url'], f'{city}: Direct link must match its verified source URL'
            else:
                candidate = user_candidate_by_id.get(candidate_id)
                assert candidate and candidate['canonical_url'] == override['url'] and candidate.get('city') == city and candidate.get('hotel') == hotel, f'{city}: Direct link must match its user-provided candidate URL'
            assert checks_by_hotel[(city, hotel)]['status'] == 'direct_link', f'{city}: Direct link without matching check'
    direct_hotels = {(city, hotel) for city, overrides in property_link_overrides.items() for hotel in overrides}
    maps_hotels = {(city, hotel) for city, overrides in maps_date_overrides.items() for hotel in overrides}
    assert all(
        ((check['city'], check['hotel']) in maps_hotels) == (check['status'] == 'date_applied')
        and ((check['city'], check['hotel']) in direct_hotels) == (check['status'] == 'direct_link')
        for check in maps_date_checks
    ), 'Maps date check and override status disagree'
    serialized_data = json.dumps(data, ensure_ascii=False)
    assert not re.search(r'NWab7SIgnrS|4RPDdm7pWWS|unique_share_id|viralityEntryPoint', serialized_data), 'User-provided data must not retain share or tracking identifiers'
    excluded_review_hosts = {
        'booking.com', 'hotels.com', 'agoda.com', 'trip.com', 'tripadvisor.com',
        'myrealtrip.com', 'expedia.com', 'expedia.co.kr', 'traveloka.com', 'trivago.com', 'trivago.co.kr', 'airbnb.com', 'airbnb.co.kr', 'tripadvisor.co.kr',
    }
    for r in reviews.values():
        host = urlsplit(sources[r['source_id']]['url']).netloc.lower()
        assert r['city'] in CITIES and r['group'] == 'korean'
        assert not any(host == domain or host.endswith(f'.{domain}') for domain in excluded_review_hosts), 'Active review uses a reservation/review platform'
        assert sources[r['source_id']]['status'] == 'verified' and r['summary'] and r['author']
    used = set()
    for row in analysis['comparisons']:
        for rid in row['review_ids']:
            assert reviews[rid]['city'] == row['city'], 'Cross-city evidence'
            used.add(rid)
        assert all(sid in sources and sources[sid]['status'] == 'verified' for sid in row.get('source_ids', [])), 'Invalid comparison source'
    assert used == set(reviews), 'Counted review missing from analysis'
    for s in sources.values():
        assert s['adopted_review_ids'] == [r['id'] for r in reviews.values() if r['source_id'] == s['id']]
    assert len({(item['city'], item['hotel']) for item in review_search_attempts}) == len(review_search_attempts), 'Duplicate review-search audit'
    assert all(
        item.keys() >= {'city', 'hotel', 'searched_at', 'channel', 'query', 'outcome'}
        and item['city'] in CITIES and item['hotel'] and item['searched_at'] == '2026-09-10'
        and item['channel'] and item['query'] and item['outcome']
        for item in review_search_attempts
    ), 'Invalid review-search audit'
    reviewed_properties = {(review['city'], review['property']) for review in reviews.values()}
    current_unreviewed = {
        (row['city'], hotel)
        for row in analysis['comparisons'] for hotel in row['hotels']
        if (row['city'], hotel) not in reviewed_properties
    }
    audited_properties = {(item['city'], item['hotel']) for item in review_search_attempts}
    pending_review_audit = current_unreviewed - audited_properties

    def esc(value):
        return html.escape(str(value if value is not None else '미확인'))

    def line_break(value):
        return esc(value).replace('\n', '<br>')

    def route_display(value):
        display = esc(value.replace('캐리어 택시', '택시').replace('캐리어 도보', '도보').replace('A1', '공항버스'))
        return re.sub(r'(약 [0-9.~]+분)', r'<strong>\1</strong>', display).replace('\n', '<br>')

    def item_lines(value):
        items = [item.strip() for line in str(value).splitlines() for item in line.split(';') if item.strip()]
        return '<br>'.join(esc(item) if item.startswith('· ') else f'· {esc(item)}' for item in items)

    def link(sid, label=None):
        return f'<a href="{esc(sources[sid]["url"])}" target="_blank" rel="noopener noreferrer">{esc(label or sid)}</a>'

    def map_link(hotel, city):
        direct_override = property_link_overrides.get(city, {}).get(hotel)
        if direct_override:
            return f'<a href="{esc(direct_override["url"])}" target="_blank" rel="noopener noreferrer">{esc(hotel)}</a>'
        override = maps_date_overrides.get(city, {}).get(hotel)
        if override:
            return f'<a href="{esc(override["url"])}" target="_blank" rel="noopener noreferrer">{esc(hotel)}</a>'
        query = quote_plus(f'{hotel}, {city}, Spain' if city not in {'Porto', 'Lisbon'} else f'{hotel}, {city}, Portugal')
        return f'<a href="https://www.google.com/maps/search/?api=1&amp;query={query}" target="_blank" rel="noopener noreferrer">{esc(hotel)}</a>'

    def direct_link_tag(hotel, city):
        override = property_link_overrides.get(city, {}).get(hotel)
        return f' <span class="tag">{esc(override["label"])}</span>' if override else ''

    def map_needed_tag(hotel, city):
        """Expose only the ordinary Maps links whose place/date state was not verified."""
        return ' <span class="tag">지도 링크 확인 필요</span>' if checks_by_hotel[(city, hotel)]['status'] == 'fallback' else ''

    def user_provided_tag(hotel, city):
        return ' <span class="tag">사용자 제공</span>' if (city, hotel) in user_provided_hotels else ''

    def catalog_hotel_link(hotel, city):
        item = user_candidate_by_property.get((city, hotel))
        if not item:
            return esc(hotel)
        name = f'<a href="{esc(item["canonical_url"])}" target="_blank" rel="noopener noreferrer">{esc(hotel)}</a>'
        return f'{name}{user_provided_tag(hotel, city)} <span class="muted">{esc(item["id"])}</span>'

    def candidate_link(item):
        if not item['canonical_url']:
            return '<span class="muted">정규화할 공개 주소 없음</span>'
        return f'<a href="{esc(item["canonical_url"])}" target="_blank" rel="noopener noreferrer">재열람 링크</a>'

    def availability_context(item):
        contexts = item.get('user_availability_contexts', [])
        if not contexts:
            return ''
        return ''.join(
            f'<br><span class="muted">사용자 제공 조회 조건: {esc(context["check_in"])}~{esc(context["check_out"])} · {esc(context["occupancy"])}</span>'
            for context in contexts
        )

    def price_link(city, item):
        template = price_checks['cities'][city]['google_hotels_url_template']
        query = quote_plus(item.get('google_hotels_query', item['hotel']))
        return f'<a href="{esc(template.format(query=query))}" target="_blank" rel="noopener noreferrer">{esc(item["hotel"])}</a>'

    def won(value):
        return f'{value:,}원'

    def platform(sid):
        domain = urlsplit(sources[sid]['url']).netloc.lower().removeprefix('www.')
        names = {
            'theqoo.net': '더쿠', 'threads.com': 'Threads', 'x.com': 'X',
            'twitter.com': 'X', 'reddit.com': 'Reddit', 'booking.com': 'Booking.com',
            'hotels.com': 'Hotels.com', 'trip.com': 'Trip.com', 'tistory.com': 'Tistory',
        }
        return names.get(domain, domain)

    out = [START, '<section id="current-analysis">', '<div class="notice"><strong>저장한 원문 요약을 바탕으로 갱신한 현재 비교표.</strong> 추천·투숙 후기 레퍼런스는 <strong>한국어 비예약사이트 실제 체류 원문만</strong> 사용한다. 예약 사이트 후기와 외국 후기는 숙소 장단점 확인 자료로만 장부에 보존한다. <a href="iberian-stay-source-summaries.json" target="_blank" rel="noopener noreferrer">요약·채택 장부 JSON</a></div>', '<h2>도시별 채택 후기</h2>', f'<p>{esc(analysis["counting_unit"])}</p>', '<div class="scroll"><table class="analysis balance"><thead><tr><th>도시</th><th>채택 한국어 후기</th><th>채택 원문 URL</th><th>비교 숙소</th><th>전체 후보 숙소</th><th>상태</th></tr></thead><tbody>']
    status_counts = collections.Counter(s['status'] for s in sources.values())
    hotel_counts = {city: len({h for row in analysis['comparisons'] if row['city'] == city for h in row['hotels']}) for city in CITIES}
    catalog_counts = {city: len({h for row in data['catalog'][city]['rows'] for h in row['hotels']}) for city in CITIES}
    assert set(data['catalog']) == set(CITIES)
    for city in CITIES:
        mapped = [h for row in data['catalog'][city]['rows'] for h in row['hotels']]
        assert len(mapped) == len(set(mapped)), f'{city}: Duplicate catalog property'
        assert all(row['area'] and row['location_note'] for row in data['catalog'][city]['rows'])
        assert {h for row in analysis['comparisons'] if row['city'] == city for h in row['hotels']} <= set(mapped), f'{city}: Comparison missing from catalog'
        compared = {h for row in analysis['comparisons'] if row['city'] == city for h in row['hotels']}
        priced_hotels = {
            item['hotel'] for item in price_checks['cities'][city]['prices']
            if item.get('listing_type', 'hotel') == 'hotel'
        }
        assert priced_hotels <= compared, f'{city}: Price hotel missing from current comparison'
        assert compared == set(comparison_details[city]), f'{city}: Comparison details missing'
        assert compared == set(hotel_areas[city]), f'{city}: Hotel area missing'
        assert all({'type', 'pros', 'cons'} <= set(detail) for detail in comparison_details[city].values()), f'{city}: Invalid comparison detail'
        assert {'schedule_condition', 'route_method', 'area_notes', 'ranking_reason'} <= set(city_context[city]), f'{city}: City context missing'
        assert all({'area', 'rank', 'route', 'pros', 'cons'} <= set(note) for note in city_context[city]['area_notes']), f'{city}: Area context missing'
        assert [note['rank'] for note in city_context[city]['area_notes']] == [f'{index}순위' for index in range(1, len(city_context[city]['area_notes']) + 1)], f'{city}: Area ranks must be consecutive and match display order'
        assert all(not re.search(r'숙소|객실|보관|체크인|엘리베이터', f'{note["pros"]} {note["cons"]}') for note in city_context[city]['area_notes']), f'{city}: Area notes must contain area-level criteria only'
        assert all(
            len(note['route'].splitlines()) in {2, 3}
            and re.fullmatch(r'· 도착: .+ \(.+\); 약 (?:\d+(?:~\d+)?분)', note['route'].splitlines()[0])
            and re.fullmatch(r'· 출발: .+ \(.+\); 약 (?:\d+(?:~\d+)?분)', note['route'].splitlines()[-1])
            and (len(note['route'].splitlines()) == 2 or re.fullmatch(r'· 공항버스: .+ \(EMT 203\)(?: → .+)?; 약 (?:\d+(?:~\d+)?분)', note['route'].splitlines()[1]))
            and all(len(line) <= 58 for line in note['route'].splitlines())
            for note in city_context[city]['area_notes']
        ), f'{city}: Area route line format invalid'
        assert all(
            note['area'] not in {'권역 미확인', '권역 미분류', '권역·단독 조건 미확인', '도시 미확인'}
            and not re.search(r'가격|미확인|미분류|단독 조건', note['rank'])
            for note in city_context[city]['area_notes']
        ), f'{city}: Area table contains a non-geographic placeholder'
        for note in city_context[city]['area_notes']:
            route_evidence = next(item for item in area_route_evidence if item['city'] == city and item['area'] == note['area'])
            for label, leg in (('도착', route_evidence['arrival']), ('출발', route_evidence['departure'])):
                line = next(line for line in note['route'].splitlines() if line.startswith(f'· {label}:'))
                if leg['mode'] == 'taxi':
                    assert '(택시)' in line and not re.search(r'도보|환승', line), f'{city}/{note["area"]}: Taxi route mixes walking or transfer'
                elif leg['mode'] == 'transit':
                    assert re.search(r'공항버스|지하철', line), f'{city}/{note["area"]}: Transit route lacks mode label'
                elif leg['mode'] == 'same_point':
                    assert '(같은 지점)' in line, f'{city}/{note["area"]}: Same-point route is unclear'
        assert all({'movement', 'luggage', 'status'} <= set(point) for point in city_context[city].get('movement_points', [])), f'{city}: Movement point missing'
        assert all(isinstance(item, str) for item in city_context[city].get('movement_glossary', [])), f'{city}: Movement glossary invalid'
        geographic_areas = {note['area'] for note in city_context[city]['area_notes']}
        assert all(
            area in geographic_areas or (
                area == '공개 원문에서 정확한 권역 확인 불가'
                and (city, hotel) in user_provided_hotels
            )
            for hotel, area in hotel_areas[city].items()
        ), f'{city}: Comparison area has no verified geographic or direct-source limitation'
        assert all(
            '가격' not in detail['pros'].replace('가격 저렴', '')
            and not re.search(r'가성비|요금|금액|세금|수수료|박당|\d{1,3}(?:,\d{3})+원', detail['pros'])
            for detail in comparison_details[city].values()
        ), f'{city}: Pros must use only the concise price wording'
    catalog_hotels = {(city, hotel) for city in CITIES for row in data['catalog'][city]['rows'] for hotel in row['hotels']}
    comparison_hotels = {(row['city'], hotel) for row in analysis['comparisons'] for hotel in row['hotels']}
    identified_user_properties = [item for item in user_provided_candidates if item.get('city') and item.get('hotel')]
    unclassified_user_candidates = [item for item in user_provided_candidates if not item.get('city') and not item.get('hotel')]
    assert len(user_provided_hotels) == len(identified_user_properties), 'Duplicate user-provided property'
    assert [item['id'] for item in unclassified_user_candidates] == ['UP03', 'UP04'], 'Unexpected unclassified user-provided candidate'
    assert all(item['placement'] == 'not_cataloged' for item in unclassified_user_candidates), 'City-unverified user source must stay out of schedule comparison and catalog'
    assert all((item['city'], item['hotel']) in catalog_hotels for item in identified_user_properties), 'User-provided property missing from catalog'
    assert all(
        ((item['city'], item['hotel']) in comparison_hotels) == (item['placement'] == 'current_comparison')
        for item in identified_user_properties
    ), 'User-provided property placement mismatch'
    price_items_by_city = {city: {item['hotel']: item for item in price_checks['cities'][city]['prices']} for city in CITIES}
    overview = ['<nav aria-label="문서 목차">' + ' '.join(f'<a href="#{anchor}" target="_self">{label}</a>' for anchor, label in [('counts','집계 요약'),('hotel-comparison','숙소 비교'),('candidate-catalog','전체 후보'),('adopted-reviews','채택 후기'),('source-ledger','전체 원문'),('research-archive','이전 기록')]) + '</nav>', '<h2 id="counts">표본·후보 수 점검 — 현재 기준</h2>', '<dl class="metrics">']
    for value, label, detail in [(len(sources),'수집한 원문 URL','중복 주소를 제외한 자료 수'),(status_counts['verified'],'본문 확인 자료','후기뿐 아니라 질문·소개·선택 발췌 포함'),(len(reviews),'비교에 채택한 개별 경험','작성자·숙소·도시로 구분'),(sum(hotel_counts.values()),'현재 비교 숙소','아래 일정별 비교표에 포함된 숙소'),(sum(catalog_counts.values()),'전체 카탈로그 숙소','후기 미채택·위치 확인 대기 후보 포함')]:
        overview.append(f'<div><dt>{label}</dt><dd>{value}<small>{detail}</small></dd></div>')
    overview.extend(['</dl>', f'<p>원문 {len(sources)}개 = 본문 확인 {status_counts["verified"]}개 + 열람 실패 {status_counts["unavailable"]}개 + 후기 근거 미확보 {status_counts["metadata_only"]}개. <strong>자료 수와 후기 수, 숙소 수는 서로 더하거나 일치시키는 숫자가 아니다.</strong> 한 글에 여러 숙소·작성자의 경험이 있고, 한 숙소를 여러 글이 다룰 수 있다. 지역명은 숙소 수에 넣지 않는다.</p>'])
    retry = data['retrieval_update']
    overview.append(f'<details><summary>재열람 결과 · {retry["attempted_sources"]}개 중 {len(retry["recovered_sources"])}개 본문 확보</summary><p>{esc(retry["note"])}</p><p>복구한 자료: ' + ' · '.join(link(sid) for sid in retry['recovered_sources']) + '</p><p>이번에 채택한 경험은 원문을 읽고 작성자·숙소를 구분한 일부다. 날짜 없는 Booking 선택 발췌는 새 채택 후기 수에 더하지 않았다.</p></details>')
    platform_followup = data.get('platform_followup')
    if platform_followup:
        overview.append(f'<details><summary>추가 플랫폼 수집 · {esc(platform_followup["date"])}</summary><p>{esc(platform_followup["result"])}</p></details>')
    if user_provided_candidates:
        rows = ''.join(
            f'<tr><th scope="row">{esc(item["id"])}</th><td>{esc(item["candidate"])} <span class="tag">사용자 제공</span><br>{candidate_link(item)}</td><td>{esc(item["result"])}{availability_context(item)}</td><td>{esc(item["placement_label"])}</td></tr>'
            for item in user_provided_candidates
        )
        overview.append(f'<details><summary>사용자 제공 후보 · {len(user_provided_candidates)}건</summary><p class="muted">공유·추적 식별자는 저장하지 않고, 재열람 가능한 정규화 주소만 표시한다. 숙소명·위치를 확인하지 못한 후보도 이 목록에 보존한다.</p><div class="scroll"><table class="analysis"><thead><tr><th>순서</th><th>후보·링크</th><th>확인 결과</th><th>목록 반영</th></tr></thead><tbody>{rows}</tbody></table></div></details>')
    out[2:2] = overview
    totals = collections.Counter()
    for city in CITIES:
        city_reviews = [r for r in reviews.values() if r['city'] == city]
        counts = collections.Counter(r['group'] for r in city_reviews)
        assert not counts['foreign'], f'{city}: Foreign review leaked into active references'
        docs = len({r['source_id'] for r in city_reviews})
        totals.update(counts)
        out.append(f'<tr data-city="{city}" data-korean="{counts["korean"]}"><th scope="row">{city}</th><td>{counts["korean"]}</td><td>{docs}</td><td>{hotel_counts[city]}</td><td>{catalog_counts[city]}</td><td>현재 규칙 적용</td></tr>')
    out.extend([f'<tr><th scope="row">전체 경험</th><td>{totals["korean"]}</td><td>{len({r["source_id"] for r in reviews.values()})}<br>도시 간 중복 제외</td><td>{sum(hotel_counts.values())}</td><td>{sum(catalog_counts.values())}</td><td>현재 규칙 적용</td></tr></tbody></table></div>', f'<p class="muted">{esc(analysis["selection_rule"])}</p>', f'<p class="caution">{esc(analysis["freshness_note"])} 한국어 비예약사이트 실제 체류 경험 {totals["korean"]}건에는 장점뿐 아니라 단점·비추천 경험도 포함한다. 현재 비교 숙소 중 원문 미확보 후보 {len(current_unreviewed)}곳 가운데 기존 검색 이력이 있는 후보는 {len(current_unreviewed) - len(pending_review_audit)}곳이며, 정책 변경 뒤 새로 미확보가 된 {len(pending_review_audit)}곳은 검색 이력 없이 미확보로만 표시한다.</p>', '<h2 id="hotel-comparison">일정에 맞춘 숙소 비교</h2>', f'<p>{esc(analysis["movement_rule"])}</p>', '<p>각 도시의 작은 설명표는 일정에서 먼저 풀어야 할 조건과 그에 맞는 권역을 보여 준다. <strong>권역 표의 장점·단점은 지형·관광·교통·일정 이동만 다루며, 숙소의 객실·보관·체크인 등 조건은 아래 숙소 행에만 적는다.</strong> 항공·버스·열차의 정확한 날짜와 시각은 보호된 일정에서 확인한다. <strong>숙소명은 Google 지도 또는 표기한 원문 링크다.</strong></p>', '<p class="caution">사용자 제공 Airbnb 중 <strong>도시와 개별 숙소가 확인된 후보만</strong> 해당 도시 일정 비교표에 표시한다. 도시를 확인하지 못한 원문·위시리스트는 상단 사용자 제공 목록에 직접 링크로 보존하며, 일정 비교·추천·가격 판단에는 넣지 않는다.</p>'])
    out.append('<p class="muted">권역 순위는 확정 승하차·캐리어 연결과 관광 접근을 함께 비교한 순서다. 택시 1~2분 차이와 후기 수는 권역 우열의 단독 근거가 아니며, 숙소 품질 순위도 아니다.</p>')
    out.append(f'<p class="caution"><strong>가격 선별은 후기 비교와 별개다.</strong> 아래 가격 통과 호텔은 Google Hotels에서 확인한 일정별 성인 2명·객실 1개, 세금·수수료 포함 금액 중 박당 {won(price_checks["cap_per_night_krw"])} 이하만 보여 준다. 확인일은 각 행에 적는다. 가격 미확인 또는 한도 초과의 일반 비교 후보는 가격 통과가 아니며 예약 전 다시 확인한다. 사용자 제공 후보는 가격과 무관하게 보존한다.</p>')
    out.append('<nav aria-label="도시 바로가기">' + ' '.join(f'<a href="#city-{city}" target="_self">{city}</a>' for city in CITIES) + '</nav>')
    for city in CITIES:
        context = city_context[city]
        area_order = {note['area']: index for index, note in enumerate(context['area_notes'])}
        def area_label(area):
            rank = context['area_notes'][area_order[area]]['rank'] if area in area_order else None
            return f'{rank} · {area}' if rank else area
        price_check = price_checks['cities'][city]
        price_passes = sorted((
            item for item in price_check['prices']
            if item.get('listing_type', 'hotel') == 'hotel'
            and item['nightly_krw'] <= price_checks['cap_per_night_krw']
        ), key=lambda item: (area_order.get(hotel_areas[city].get(item['hotel']), len(area_order)), item['hotel']))
        current_hotels = {hotel for hotel, _ in ((hotel, row) for row in analysis['comparisons'] if row['city'] == city for hotel in row['hotels'])}
        current_user_hotels = {
            hotel for candidate_city, hotel in user_provided_hotels
            if candidate_city == city and hotel in current_hotels
        }
        ordinary_current_hotels = {
            hotel for hotel in current_hotels - current_user_hotels
            if comparison_details[city][hotel]['type'] == '호텔'
        }
        non_hotel_current = sorted(
            hotel for hotel in current_hotels - current_user_hotels
            if comparison_details[city][hotel]['type'] != '호텔'
        )
        current_price_passes = sorted(
            (hotel for hotel in ordinary_current_hotels & set(price_items_by_city[city])
            if price_items_by_city[city][hotel].get('listing_type', 'hotel') == 'hotel'
            and price_items_by_city[city][hotel]['nightly_krw'] <= price_checks['cap_per_night_krw']),
            key=lambda hotel: (area_order.get(hotel_areas[city].get(hotel), len(area_order)), hotel)
        )
        ordinary_price_over = sorted(
            hotel for hotel in ordinary_current_hotels & set(price_items_by_city[city])
            if price_items_by_city[city][hotel].get('listing_type', 'hotel') == 'hotel'
            and price_items_by_city[city][hotel]['nightly_krw'] > price_checks['cap_per_night_krw']
        )
        ordinary_price_unknown = sorted(ordinary_current_hotels - set(price_items_by_city[city]))
        price_rows = ''.join(
            f'<tr><th scope="row">{price_link(city, item)}'
            f'</th><td>{won(item["nightly_krw"])}</td><td>{won(item["stay_total_krw"])}</td><td>{esc(item["checked_at"])}</td></tr>'
            for item in price_passes
        )
        price_summary = (
            f'<details><summary>가격 통과 호텔 · {len(price_passes)}곳</summary>'
            f'<p class="muted">{price_check["check_in"]} → {price_check["check_out"]} · {esc(price_checks["occupancy"])} · {esc(price_checks["taxes_and_fees"])} · 원장 최초 확인 {price_checks["as_of"]} · 최근 갱신 {price_checks["updated_at"]}</p>'
            f'<div class="scroll"><table class="analysis"><thead><tr><th>Google Hotels 숙소</th><th>박당</th><th>전체 숙박</th><th>확인일</th></tr></thead><tbody>{price_rows}</tbody></table></div>'
            f'<p class="muted">현재 후기 비교표에서 가격 통과: {esc(" · ".join(current_price_passes) or "없음")}. '
            f'한도 초과 일반 비교 후보: {esc(" · ".join(ordinary_price_over) or "없음")}. '
            f'가격 미확인 일반 비교 후보: {esc(" · ".join(ordinary_price_unknown) or "없음")}. '
            f'호텔 전용 가격표 제외: {esc(" · ".join(non_hotel_current) or "없음")}. '
            f'사용자 제공 · 가격 필터 예외: {esc(" · ".join(sorted(current_user_hotels)) or "없음")}. '
            '이 가격표의 숙소는 후기 비교표 편입이나 추천 후기를 뜻하지 않는다.</p></details>'
        )
        movement_rows = ''.join(
            f'<tr><th scope="row">{esc(point["movement"])}</th><td>{esc(point["luggage"])}</td><td>{esc(point["status"])}</td></tr>'
            for point in context.get('movement_points', [])
        )
        glossary = ' · '.join(esc(item) for item in context.get('movement_glossary', []))
        area_rows = ''.join(f'<tr><th scope="row" data-label="권역 추천순위">{esc(note["rank"])} · {esc(note["area"])}</th><td class="area-route" data-label="짐 이동 경로 확인">{route_display(note["route"])}</td><td data-label="권역 장점">{item_lines(note["pros"])}</td><td data-label="권역 단점">{item_lines(note["cons"])}</td></tr>' for note in context['area_notes'])
        movement_table = '' if not movement_rows else f'<div class="scroll city-context"><table class="analysis"><thead><tr><th>일정상 승하차 지점</th><th>짐을 든 이동 기준</th><th>확인 상태</th></tr></thead><tbody>{movement_rows}</tbody></table></div>'
        glossary_note = '' if not glossary else f'<p class="muted"><strong>지점 읽는 법:</strong> {glossary}</p>'
        out.append(f'<h3 id="city-{city}">{city}</h3><p class="muted">일정 조건: {esc(context["schedule_condition"])}<br>경로 계산: {esc(context["route_method"])}<br>권역 순위 근거: {esc(context["ranking_reason"])}</p>{price_summary}{glossary_note}{movement_table}<div class="scroll city-context"><table class="analysis area-context"><thead><tr><th>권역 추천순위</th><th>짐 이동 경로 확인</th><th>권역 장점</th><th>권역 단점</th></tr></thead><tbody>{area_rows}</tbody></table></div><div class="scroll"><table class="analysis candidates"><thead><tr><th>숙소 이름</th><th>타입</th><th>권역</th><th>장점</th><th>단점</th><th>추천·투숙 후기</th></tr></thead><tbody>')
        entries = sorted(((hotel, row) for row in analysis['comparisons'] if row['city'] == city for hotel in row['hotels']), key=lambda entry: area_order.get(hotel_areas[city][entry[0]], len(area_order)))
        for hotel, row in entries:
            detail = comparison_details[city][hotel]
            review_source_ids = [
                reviews[rid]['source_id'] for rid in row['review_ids']
                if reviews[rid]['property'] == hotel
            ]
            refs = ' · '.join(link(sid) for sid in dict.fromkeys(review_source_ids))
            out.append(f'<tr><th scope="row" data-label="숙소 이름">{map_link(hotel, city)}{direct_link_tag(hotel, city)}{map_needed_tag(hotel, city)}{user_provided_tag(hotel, city)}</th><td data-label="타입">{esc(detail["type"])}</td><td data-label="권역">{esc(area_label(hotel_areas[city][hotel]))}</td><td data-label="장점">{item_lines(detail["pros"])}</td><td data-label="단점">{item_lines(detail["cons"])}</td><td data-label="추천·투숙 후기">{refs or "추천 후기 미확보"}</td></tr>')
        out.append('</tbody></table></div>')
    out.append(f'<section id="candidate-catalog"><h2>전체 후보·원문 카탈로그</h2><p>권역과 해당 숙소를 같은 행에 배치했다. 아래는 후보 보존 목록이며 현재 추천·후기 채택과 다르다. <strong>사용자 제공 후보 {len(user_provided_candidates)}건 중 도시·숙소명을 확인한 {len(identified_user_properties)}건만</strong> 해당 도시 행에 표시한다. 도시를 확인하지 못한 원문은 상단 사용자 제공 목록에 보존한다.</p>')
    for city in CITIES:
        context = city_context[city]
        area_order = {note['area']: index for index, note in enumerate(context['area_notes'])}
        out.append(f'<details open><summary>{city} · 숙소 {catalog_counts[city]}개</summary><div class="scroll"><table class="analysis catalog"><thead><tr><th>권역</th><th>해당 권역의 숙소 후보</th><th>자료 연결 · 위치 확인</th></tr></thead><tbody>')
        catalog_rows = sorted(
            data['catalog'][city]['rows'],
            key=lambda row: min((area_order.get(hotel_areas[city].get(hotel), len(area_order)) for hotel in row['hotels']), default=len(area_order))
        )
        for row in catalog_rows:
            refs = list(dict.fromkeys(r['source_id'] for r in reviews.values() if r['city'] == city and r['property'] in row['hotels']))
            hotels = '<br>'.join(catalog_hotel_link(h, city) for h in row['hotels']) or '확인된 숙소 없음'
            mapped_areas = {hotel_areas[city].get(hotel) for hotel in row['hotels']}
            mapped_areas.discard(None)
            assert len(mapped_areas) <= 1, f'{city}: Catalog row mixes ranked areas'
            mapped_ranks = [area_order.get(area) for area in mapped_areas]
            mapped_ranks = [rank for rank in mapped_ranks if rank is not None]
            catalog_area = f'{context["area_notes"][min(mapped_ranks)]["rank"]} · {row["area"]}' if mapped_ranks else row['area']
            out.append(f'<tr><th scope="row">{esc(catalog_area)}</th><td>{hotels}</td><td>{esc(row["location_note"])}<p>{" · ".join(link(sid) for sid in refs) or "현재 채택 후기 연결 없음"}</p></td></tr>')
        assert all(sid in sources for sid in data['catalog'][city]['source_ids'])
        out.append('</tbody></table></div><details><summary>이 도시의 원문 목록 · 채택 여부와 별개</summary><p>' + ' · '.join(link(sid) for sid in data['catalog'][city]['source_ids']) + '</p></details></details>')
    out.append('</section>')
    out.append('<h2 id="adopted-reviews">분석에 채택한 개별 후기</h2><p>위 숫자를 구성한 작성자·숙소·요약이다. 같은 원문 안의 여러 후기는 각각 식별하고, 현재 비교에 사용하지 않은 다른 댓글은 계산에 넣지 않았다.</p>')
    for city in CITIES:
        out.append(f'<details><summary>{city} · 채택 경험 보기</summary><ul>')
        for r in (r for r in reviews.values() if r['city'] == city):
            out.append(f'<li id="{r["id"]}"><strong>{r["id"]} · 한국어 원문 · {esc(r["property"])}</strong> — {esc(r["author"])} · {esc(r["published_at"])} · {esc(platform(r["source_id"]))} · {link(r["source_id"])}<br>{esc(r["summary"])}</li>')
        out.append('</ul></details>')
    out.append('</section><section id="source-ledger"><h2>전체 수집 원문 요약 장부</h2>')
    counts = collections.Counter(s['status'] for s in sources.values())
    out.append(f'<p>전체 {len(sources)}개 URL: 본문 확인·요약 {counts["verified"]}개, 후기 근거 미확보/미검증 {counts["metadata_only"]}개, 열람 실패 {counts["unavailable"]}개. 읽지 못한 본문은 요약을 만들지 않았고 접근 실패 사유를 저장했다. 본문 확인에는 질문·숙소 소개도 포함되므로 후기 개수와 다르다.</p>')
    labels = {'verified': '본문 확인·요약', 'metadata_only': '후기 근거 미확보/미검증', 'unavailable': '열람 실패'}
    out.append(f'<details><summary>전체 원문 {len(sources)}개 · 요약·한계·채택 상태 보기</summary>')
    for s in sources.values():
        label = (s.get('labels') or [s.get('author') or s['url']])[0]
        out.append(f'<details id="{s["id"]}"><summary>{s["id"]} · {esc(label)} · {labels[s["status"]]}</summary><p>{link(s["id"], "원문 열기")} · 게시: {esc(s.get("published_at") or s.get("observed_age"))} · 확인: {esc(s.get("verified_at"))}</p><p>{esc(s.get("summary") or "본문을 확보하지 못해 요약하지 않았다. 분석 근거로 사용하지 않는다.")}</p>')
        if s.get('original_url'):
            out.append(f'<p>기존 저장 주소: <a href="{esc(s["original_url"])}" target="_blank" rel="noopener noreferrer">기존 링크</a> · 위 원문 열기는 본문을 확인한 동일 게시글 ID의 주소다.</p>')
        if s.get('retrieval_attempts'):
            out.append('<details><summary>열람 시도 이력</summary><ul>' + ''.join(f'<li>{esc(a["date"])} · {esc(a["method"])} — {esc(a["result"])}</li>' for a in s['retrieval_attempts']) + '</ul></details>')
        if s.get('positive'):
            out.append('<ul>' + ''.join(f'<li>{esc(item)}</li>' for item in s['positive']) + '</ul>')
        out.append(f'<p class="muted">{esc(" / ".join(s.get("caveats", [])))}</p><p>분석: {esc(" · ".join(s["adopted_review_ids"]) or "미채택")} — {esc(s["analysis_reason"])}</p></details>')
    out.append('</details></section>')
    legacy = archive['legacy_html']
    legacy = re.sub(r'<h2>표본·후보 수 점검</h2>.*?(?=<h2>권역별 호텔 매핑</h2>)', '<p>이전 표본·후보 수 표시는 현 집계와 혼동되어 화면에서 제외했다. <a href="#counts" target="_self">현재 집계 요약</a>을 사용한다. 당시 값은 보관 JSON에 남아 있다.</p>', legacy, flags=re.S)
    legacy = legacy.replace('<details><summary>이전 조사표 보관', '<details id="research-archive"><summary>이전 조사표 보관', 1)
    out.append(legacy)
    out.append('<p class="muted">자료 파일: <a href="iberian-stay-source-summaries.json">현재 원장</a> · <a href="iberian-stay-research-archive.json">이전 조사 보관</a>. 각 JSON의 _meta에 목적·형식·수정 규칙을 기록했다. 현재 화면의 수치는 같은 원장에서 계산한다.</p>')
    out.append(END)
    block = '\n'.join(out)
    comparison_section = block.split('<h2 id="hotel-comparison">', 1)[1].split('<section id="candidate-catalog">', 1)[0]
    assert '도시 미확인' not in comparison_section, 'Schedule comparison must not contain city-unidentified listings'
    visible_text_without_map_status = block.replace('지도 링크 확인 필요', '')
    assert '확인' + ' 필요' not in visible_text_without_map_status, 'Visible research text must state verified evidence or 확인 불가 provenance'
    assert '<span class="tag">가격' not in block and '10만원대 가격 확인</span>' not in block, 'Visible price-status tags are not allowed'
    assert block.count('지도 링크 확인 필요</span>') == sum(
        check['status'] == 'fallback' for check in maps_date_checks
    ), 'Every and only unresolved Maps link must carry the map-check tag'
    return block


def main():
    data = json.loads(DATA.read_text())
    archive = json.loads(ARCHIVE.read_text())
    assert {p.name for p in DATA.parent.glob('iberian-stay-*.json')} == {DATA.name, ARCHIVE.name}, 'Duplicate-role research JSON: consolidate into the current ledger or archive'
    assert all(d['_meta'].get(k) for d in (data, archive) for k in ('schema_version', 'purpose', 'format', 'write_policy', 'consumed_by'))
    page = PAGE.read_text()
    block = render(data, archive)
    before, old = page.split(START, 1)
    _, after = old.split(END, 1)
    expected = before + block + after
    if '--check' in sys.argv:
        assert expected == page, 'Research HTML is stale; run python3 scripts/render-stay-research.py'
        print('Research verified: sources, summaries, unique experiences, city balance, comparison references, and rendered HTML.')
    else:
        PAGE.write_text(expected)
        print('Rendered research analysis and source ledger.')


if __name__ == '__main__':
    main()
